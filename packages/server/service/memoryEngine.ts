// src/server/services/memoryEngine.ts

import { MemoryResponse } from '@rita-berenice/shared/api';
import { LangCode, DEFAULT_EMOTION, NA } from '@rita-berenice/shared/config';
import { ChatTurn, RecapInfo } from '@rita-berenice/shared/domain';
import {
	parseSessionId,
	convertArrayToString,
	resolveUtilityModelInfo,
} from '@rita-berenice/shared/util';
import { ChatCompletionMessageParam } from 'openai/resources/index.mjs';
import { characterStore } from '../store/characterStore.js';
import { chatStore } from '../store/chatStore.js';
import { historyStore } from '../store/historyStore.js';
import { loreStore } from '../store/loreStore.js';
import { documentStore, documentToEmbeddingContent } from '../store/documentStore.js';
import { profileStore } from '../store/profileStore.js';
import { recapStore } from '../store/recapStore.js';
import { termStore } from '../store/termStore.js';
import { parseEntriesToConversation } from '../util/chatParseUtils.js';
import { flowLogger } from '../util/jsonlLogger.js';
import { boostByCriticalTerm, mapLoreContexts, mapHistoryContexts } from '../util/llmUtils.js';
import { expandWithFollowingItems } from '../util/ragContinuityUtils.js';
import {
	boostByQueryTerms,
	countQueryTermHits,
	extractRetrievalBoostTerms,
	hasEarliestEventIntent,
	selectEarliestRelevantMatches,
	selectHighConfidenceQueryMatches,
} from '../util/ragKeywordUtils.js';
import { createRagTraceContext, traceRagEvent } from '../util/ragTraceUtils.js';
import { createChatTurnMetadataSchema } from '../util/schemaUtils.js';
import { handleServiceError } from '../util/serviceHelpers.js';
import { buildChatTurnMetadataPrompt } from '../util/templateUtils.js';
import { createQueryEmbeddingCache } from './embeddingService.js';
import { llmService } from './llmService.js';
import { ragQueryService } from './ragQueryService.js';

export const memoryEngine = {
	/**
	 * Gathers all relevant context (memories) needed to generate a coherent, in-character response.
	 */
	async recallRelevantMemories(
		sessionId: string,
		userConversation: string,
		userId: string,
		recentChatTurns: ChatTurn[],
		langCode: LangCode,
		// The model the caller is about to generate with. Query transformation is an LLM call like
		// any other, so it has to run on a provider this user holds a key for. Required: every
		// caller already has a model in hand, and defaulting it would silently send the RAG calls
		// back to OpenAI for a user who never registered an OpenAI key.
		chatModelName: string
	): Promise<MemoryResponse> {
		const { characterId } = parseSessionId(sessionId);
		const INITIAL_QUERY_LIMIT = 30;
		const INITIAL_RECAP_QUERY_LIMIT = 20;
		const FINAL_MEMORY_LIMIT = 5;
		const MAX_CONTINUATION_TURNS = 4;
		const { request, response } = recentChatTurns[0];
		const ragTraceContext = createRagTraceContext({
			sessionId,
			userId,
			characterId,
			turnId: request.messageId,
			sequence: request.sequence,
		});

		try {
			const transformedQuery = await ragQueryService.transformQuery(
				userConversation,
				sessionId,
				userId,
				request.showName,
				response.showName,
				resolveUtilityModelInfo(chatModelName)
			);
			flowLogger.info('memoryEngine', 'queryTransformed', {
				sessionId,
				userId,
				characterId,
				queryCount: transformedQuery.queryTexts.length,
				hasCriticalTerm: Boolean(transformedQuery.criticalTerm),
			});
			traceRagEvent(ragTraceContext, 'query.transformed', {
				queryTexts: transformedQuery.queryTexts,
				criticalTerm: transformedQuery.criticalTerm,
				filterCriteria: transformedQuery.filterCriteria,
			});
			const queryEmbeddingCache = createQueryEmbeddingCache();

			const [longTermChatRes, relevantLoreRes, relevantHistoryRes, relevantRecaps, relevantDocuments] =
				await Promise.all([
					chatStore.queryChatTurns(
						sessionId,
						transformedQuery.queryTexts,
						transformedQuery.filterCriteria,
						undefined,
						INITIAL_QUERY_LIMIT,
						queryEmbeddingCache,
						ragTraceContext
					),
					loreStore.queryLores(
						characterId,
						userId,
						sessionId,
						transformedQuery.queryTexts,
						transformedQuery.filterCriteria,
						undefined,
						undefined,
						queryEmbeddingCache,
						ragTraceContext
					),
					historyStore.queryHistories(
						characterId,
						transformedQuery.queryTexts,
						transformedQuery.filterCriteria,
						undefined,
						undefined,
						queryEmbeddingCache,
						ragTraceContext
					),
					recapStore.queryRecaps(
						sessionId,
						transformedQuery.queryTexts,
						'recap',
						transformedQuery.filterCriteria,
						undefined,
						INITIAL_RECAP_QUERY_LIMIT,
						queryEmbeddingCache,
						ragTraceContext
					),
					documentStore.queryApproved(
						sessionId,
						userId,
						characterId,
						transformedQuery.queryTexts,
						5,
						queryEmbeddingCache,
						ragTraceContext
					),
				]);

			// Step 1: Apply critical-term and query-keyword boosting to all result types.
			const criticalTerm = transformedQuery.criticalTerm;
			const boostTerms = extractRetrievalBoostTerms(
				userConversation,
				criticalTerm,
				[request.showName, response.showName],
				transformedQuery.termAliases
			);
			const semanticChatTurns = longTermChatRes.chatTurns || [];
			const keywordFallbackChatTurns = await getKeywordFallbackChatTurns(
				sessionId,
				boostTerms,
				semanticChatTurns
			);
			const keywordFallbackRecaps = await getKeywordFallbackRecaps(
				sessionId,
				boostTerms,
				relevantRecaps || []
			);
			const boostedChatTurns = boostByQueryTerms(
				boostByCriticalTerm([...semanticChatTurns, ...keywordFallbackChatTurns], criticalTerm),
				boostTerms,
				(turn) => JSON.stringify(turn)
			);
			const boostedLore = boostByQueryTerms(
				boostByCriticalTerm(relevantLoreRes.loreInfos || [], criticalTerm),
				boostTerms,
				(lore) => JSON.stringify(lore)
			);
			const boostedHistory = boostByQueryTerms(
				boostByCriticalTerm(relevantHistoryRes.historyInfos || [], criticalTerm),
				boostTerms,
				(history) => JSON.stringify(history)
			);
			const boostedRecaps = boostByQueryTerms(
				[...(relevantRecaps || []), ...keywordFallbackRecaps],
				boostTerms,
				(recap) => JSON.stringify(recap)
			);

			// Step 3: Check for low retrieval and apply fallback if needed
			const totalResults =
				boostedChatTurns.length +
				boostedLore.length +
				boostedHistory.length +
				boostedRecaps.length +
				relevantDocuments.length;
			const selectedDocuments = boostByQueryTerms(relevantDocuments, boostTerms, (document) =>
				documentToEmbeddingContent(document)
			).slice(0, FINAL_MEMORY_LIMIT);

			if (totalResults < 3 && criticalTerm) {
				flowLogger.warn('memoryEngine', 'criticalTermFallback.start', {
					sessionId,
					userId,
					characterId,
					totalResults,
					hasCriticalTerm: true,
				});

				const fallbackChatRes = await chatStore.queryChatTurns(
					sessionId,
					[criticalTerm], // Just the critical term
					undefined, // No metadata filtering
					undefined,
					FINAL_MEMORY_LIMIT, // Lower limit for fallback
					queryEmbeddingCache,
					ragTraceContext
				);

				if (fallbackChatRes.chatTurns?.length > 0) {
					// Merge fallback results with existing ones, avoiding duplicates
					const existingIds = new Set(boostedChatTurns.map((turn) => turn.chatTurnId));
					const newFallbackTurns = fallbackChatRes.chatTurns.filter(
						(turn) => !existingIds.has(turn.chatTurnId)
					);
					boostedChatTurns.push(...newFallbackTurns);
					flowLogger.info('memoryEngine', 'criticalTermFallback.complete', {
						sessionId,
						userId,
						characterId,
						additionalResults: newFallbackTurns.length,
					});
				}
			}

			const selectedChatTurns = hasEarliestEventIntent(userConversation)
				? selectEarliestRelevantMatches(
						boostedChatTurns,
						boostTerms,
						(turn) => JSON.stringify(turn),
						(turn) => turn.sequence,
						FINAL_MEMORY_LIMIT
					)
				: selectHighConfidenceQueryMatches(
						boostedChatTurns,
						boostTerms,
						(turn) => JSON.stringify(turn),
						FINAL_MEMORY_LIMIT
					);
			const selectedRecaps = selectHighConfidenceQueryMatches(
				boostedRecaps,
				boostTerms,
				(recap) => JSON.stringify(recap),
				FINAL_MEMORY_LIMIT
			);
			const continuationSequences = selectedChatTurns.map((turn) => turn.sequence + 1);
			const continuationCandidates = (
				await chatStore.getChatTurnsBySequences(sessionId, continuationSequences)
			).chatTurns;
			const expandedChatTurns = expandWithFollowingItems(selectedChatTurns, continuationCandidates, {
				getId: (turn) => turn.chatTurnId,
				getSequence: (turn) => turn.sequence,
				excludedIds: recentChatTurns.map((turn) => turn.chatTurnId),
				maxContinuations: MAX_CONTINUATION_TURNS,
			});

			// Step 4: Log analysis for debugging and optimization
			flowLogger.info('memoryEngine', 'retrievalAnalysis', {
				sessionId,
				userId,
				characterId,
				inputLength: userConversation.length,
				hasCriticalTerm: Boolean(criticalTerm),
				boostTermCount: boostTerms.length,
				results: {
					longTermChat: boostedChatTurns.length,
					keywordFallbackChat: keywordFallbackChatTurns.length,
					lore: boostedLore.length,
					history: boostedHistory.length,
					recap: boostedRecaps.length,
					document: selectedDocuments.length,
					keywordFallbackRecap: keywordFallbackRecaps.length,
				},
				finalSelections: {
					longTermSelected: selectedChatTurns.length,
					longTermContinuations: expandedChatTurns.continuations.length,
					loreSelected: boostedLore.length,
					historySelected: boostedHistory.length,
					recapSelected: selectedRecaps.length,
					documentSelected: selectedDocuments.length,
				},
				selectedIds: {
					longTermChatAnchors: selectedChatTurns.map((turn) => turn.chatTurnId),
					longTermChatContinuations: expandedChatTurns.continuations.map((turn) => turn.chatTurnId),
					lore: boostedLore.map((lore) => lore.loreId),
					history: boostedHistory.map((history) => history.historyId),
					recap: selectedRecaps.map((recap) => recap.recapId),
					document: selectedDocuments.map((document) => document.documentId),
				},
			});
			traceRagEvent(ragTraceContext, 'retrieval.selected', {
				criticalTermFallbackUsed: totalResults < 3 && Boolean(criticalTerm),
				boostTerms,
				keywordFallbackIds: {
					chat: keywordFallbackChatTurns.map((turn) => turn.chatTurnId),
					recap: keywordFallbackRecaps.map((recap) => recap.recapId),
				},
				selectedIds: {
					chatAnchors: selectedChatTurns.map((turn) => turn.chatTurnId),
					chatContinuations: expandedChatTurns.continuations.map((turn) => turn.chatTurnId),
					lore: boostedLore.map((lore) => lore.loreId),
					history: boostedHistory.map((history) => history.historyId),
					recap: selectedRecaps.map((recap) => recap.recapId),
					document: selectedDocuments.map((document) => document.documentId),
				},
			});

			// Step 5: Return final curated memory response
			return {
				langCode,
				shortTermHistory: recentChatTurns,
				longTermHistory: expandedChatTurns.items,
				relevantLore: boostedLore,
				relevantHistory: boostedHistory,
				relevantDocuments: selectedDocuments,
				relevantRecaps: selectedRecaps,
				factualRecapSummary: selectedRecaps.map((recap) => recap.content).join('\n\n'),
			};
		} catch (error) {
			traceRagEvent(ragTraceContext, 'retrieval.failed', {
				errorName: error instanceof Error ? error.name : 'UnknownError',
				errorMessage: error instanceof Error ? error.message : String(error),
			});
			handleServiceError(
				error,
				'An internal error occurred while do [recallRelevantMemories].',
				`Failed to recall relevant memories ${userConversation.substring(0, 30)}...`
			);
		}
	},

	/**
	 * Takes a chat turn, enriches it with LLM-generated metadata, and populates the `enrichedMetadata` field.
	 * This process includes term standardization using the session glossary.
	 */
	async enrichChatTurnViaLlm(
		turn: ChatTurn,
		options: { skipTermNormalization?: boolean } = {}
	): Promise<ChatTurn> {
		const { sessionId, userId } = turn;
		const { characterId } = parseSessionId(sessionId);
		// Enrichment must run on the same provider that generated the turn. Pinning it to
		// DEFAULT_EXTRACTION_MODEL made every finalization fail for accounts with no OpenAI key.
		const utilityModelInfo = resolveUtilityModelInfo(turn.response.model);

		try {
			// 1. Extract named entities to ensure they are in the glossary.
			const textForNer = `${parseEntriesToConversation(
				turn.request.entries
			)}\n${parseEntriesToConversation(turn.response.entries)}`;
			const extractedKpns = options.skipTermNormalization
				? []
				: await llmService.extractProperNouns(textForNer, userId, utilityModelInfo);

			// 2. Fetch all necessary context for the enrichment prompt.
			const [profileInfo, charInfo, loreRes, historyRes, termGuidanceMap] = await Promise.all([
				profileStore.getProfileBySessionId(sessionId),
				characterStore.getCharacter(characterId),
				loreStore.getLoresBySession(sessionId, characterId, userId),
				historyStore.getHistories(characterId),
				termStore.ensureAndGetTermsForPrompt(sessionId, userId, extractedKpns, utilityModelInfo),
			]);

			const loreContexts = mapLoreContexts(loreRes.loreInfos);
			const historyContexts = mapHistoryContexts(historyRes.historyInfos);

			const zodSchema = createChatTurnMetadataSchema(
				profileInfo.profileInfo.name,
				charInfo.characterInfo.name
			);

			// 3. Build the prompt and invoke the LLM with a defined schema.
			const prompt = buildChatTurnMetadataPrompt(
				profileInfo.profileInfo,
				turn.request,
				charInfo.characterInfo,
				turn.response,
				loreContexts,
				historyContexts,
				termGuidanceMap
			);

			const messages: ChatCompletionMessageParam[] = [
				{
					role: 'system',
					content:
						'You are a helpful assistant that analyzes conversation turns and provides structured metadata in JSON format.',
				},
				{ role: 'user', content: prompt },
			];

			flowLogger.info('memoryEngine', 'enrichChatTurn.start', {
				sessionId,
				userId,
				characterId,
				chatTurnId: turn.chatTurnId,
				sequence: turn.sequence,
				turnModel: turn.response.model,
				utilityModel: utilityModelInfo.model,
				extractedProperNounCount: extractedKpns.length,
				loreContextCount: loreContexts.length,
				historyContextCount: historyContexts.length,
				termCount: termGuidanceMap.size,
			});

			const enrichment = await llmService.invokeStructuredLlm(
				messages,
				utilityModelInfo,
				userId,
				zodSchema
			);

			flowLogger.info('memoryEngine', 'enrichChatTurn.complete', {
				sessionId,
				userId,
				characterId,
				chatTurnId: turn.chatTurnId,
				keywordCount: enrichment.keywordList?.length ?? 0,
				topicCount: enrichment.topicList?.length ?? 0,
				entityCount: enrichment.entityList?.length ?? 0,
				loreReferenceCount: enrichment.loreReferenceList?.length ?? 0,
				historyReferenceCount: enrichment.historyReferenceList?.length ?? 0,
			});

			// 4. Create the final rich ChatTurn object.
			return _extractChatTurnMetadataInfoFromLlm(turn, enrichment);
		} catch (error) {
			handleServiceError(error, `Failed to enrich metadata for chatTurn ${turn.chatTurnId}`);
		}
	},
};

const getKeywordFallbackChatTurns = async (
	sessionId: string,
	boostTerms: string[],
	existingTurns: ChatTurn[],
	limit = 10
): Promise<ChatTurn[]> => {
	if (!boostTerms.length) return [];

	const existingIds = new Set(existingTurns.map((turn) => turn.chatTurnId));
	const keywordCandidateTurns =
		(
			await chatStore.queryChatTurnsByKeywords(
				sessionId,
				boostTerms,
				[...existingIds],
				Math.max(limit * 5, 50)
			)
		).chatTurns || [];

	return keywordCandidateTurns
		.map((turn, index) => ({
			turn,
			index,
			hitCount: countQueryTermHits(JSON.stringify(turn), boostTerms),
		}))
		.filter((item) => item.hitCount > 0)
		.sort((left, right) => right.hitCount - left.hitCount || left.index - right.index)
		.slice(0, limit)
		.map((item) => item.turn);
};

const getKeywordFallbackRecaps = async (
	sessionId: string,
	boostTerms: string[],
	existingRecaps: RecapInfo[],
	limit = 10
): Promise<RecapInfo[]> => {
	if (!boostTerms.length) return [];

	const existingIds = new Set(existingRecaps.map((recap) => recap.recapId));
	const keywordCandidateRecaps = await recapStore.queryRecapsByKeywords(
		sessionId,
		boostTerms,
		'recap',
		[...existingIds],
		Math.max(limit * 5, 50)
	);

	return keywordCandidateRecaps
		.map((recap, index) => ({
			recap,
			index,
			hitCount: countQueryTermHits(JSON.stringify(recap), boostTerms),
		}))
		.filter((item) => item.hitCount > 0)
		.sort((left, right) => right.hitCount - left.hitCount || left.index - right.index)
		.slice(0, limit)
		.map((item) => item.recap);
};

/**
 * @private
 * Safely merges a ChatTurn with LLM-generated enrichment data.
 * This function now populates the consistent `...List` properties.
 */
function _extractChatTurnMetadataInfoFromLlm(
	turn: ChatTurn,
	enrichment: Record<string, any>
): ChatTurn {
	return {
		...turn,
		summary: enrichment.summary || '',
		keywordList: Array.isArray(enrichment.keywordList) ? enrichment.keywordList : [],
		topicList: Array.isArray(enrichment.topicList) ? enrichment.topicList : [],
		entityList: Array.isArray(enrichment.entityList) ? enrichment.entityList : [],
		actionList: Array.isArray(enrichment.actionList) ? enrichment.actionList : [],
		flagList: Array.isArray(enrichment.flagList) ? enrichment.flagList : [],
		relationshipShiftList: Array.isArray(enrichment.relationshipShiftList)
			? enrichment.relationshipShiftList
			: [],
		userEmotion: {
			primary: enrichment.userEmotion?.primary || DEFAULT_EMOTION,
			intensity: enrichment.userEmotion?.intensity ?? 0.5,
			nuanceList: Array.isArray(enrichment.userEmotion?.nuanceList)
				? enrichment.userEmotion.nuanceList
				: [],
		},
		characterEmotion: {
			primary: enrichment.characterEmotion?.primary || 'neutral',
			intensity: enrichment.characterEmotion?.intensity ?? 0.5,
			nuanceList: Array.isArray(enrichment.characterEmotion?.nuanceList)
				? enrichment.characterEmotion.nuanceList
				: [],
		},
		dialogueAct: enrichment.dialogueAct || NA,
		memoryChunk: enrichment.memoryChunk || '',
		loreReferenceList: Array.isArray(enrichment.loreReferenceList)
			? enrichment.loreReferenceList
			: [],
		historyReferenceList: Array.isArray(enrichment.historyReferenceList)
			? enrichment.historyReferenceList
			: [],
	};
}

/**
 * @private
 * Formats a recap into a concise string for inclusion in a prompt.
 */
function _formatRecapForPrompt(recap: RecapInfo): string {
	const flags = recap.flagList.length > 0 ? ` [FLAGS: ${convertArrayToString(recap.flagList)}]` : '';
	return `[Recap from turns ${recap.turnStart}-${recap.turnEnd}]${flags} Summary: ${recap.content}...`;
}
