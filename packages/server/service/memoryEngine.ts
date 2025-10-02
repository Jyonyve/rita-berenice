// src/server/services/memoryEngine.ts

import { MemoryResponse } from "@rita-berenice/shared/api";
import { LangCode, DEFAULT_EMOTION, NA } from "@rita-berenice/shared/config";
import { ChatTurn, DEFAULT_EXTRACTION_MODEL, RecapInfo } from "@rita-berenice/shared/domain";
import { parseSessionId, convertArrayToString } from "@rita-berenice/shared/util";
import { ChatCompletionMessageParam } from "openai/resources/index.mjs";
import { characterStore } from "../store/characterStore.js";
import { chatStore } from "../store/chatStore.js";
import { historyStore } from "../store/historyStore.js";
import { loreStore } from "../store/loreStore.js";
import { profileStore } from "../store/profileStore.js";
import { termStore } from "../store/termStore.js";
import { parseEntriesToConversation } from "../util/chatParseUtils.js";
import { logFlow } from "../util/jsonlLogger.js";
import { reRankByRecency, boostByCriticalTerm, mapLoreContexts, mapHistoryContexts } from "../util/llmUtils.js";
import { createChatTurnMetadataSchema } from "../util/schemaUtils.js";
import { handleServiceError } from "../util/serviceHelpers.js";
import { buildChatTurnMetadataPrompt } from "../util/templateUtils.js";
import { llmService } from "./llmService.js";
import { ragQueryService } from "./ragQueryService.js";



export const memoryEngine = {
	/**
	 * Gathers all relevant context (memories) needed to generate a coherent, in-character response.
	 */
	async recallRelevantMemories(
		sessionId: string,
		userConversation: string,
		userId: string,
		recentChatTurns: ChatTurn[],
		langCode: LangCode
	): Promise<MemoryResponse> {
		const { characterId } = parseSessionId(sessionId);
		const INITIAL_QUERY_LIMIT = 10;
		const FINAL_MEMORY_LIMIT = 5;
		const { request, response } = recentChatTurns[0];

		try {
			const transformedQuery = await ragQueryService.transformQuery(
				userConversation,
				sessionId,
				userId,
				request.showName,
				response.showName
			);
			logFlow('ragQueryService', 'API HIT: transformQuery', { transformedQuery });

			const [longTermChatRes, relevantLoreRes, relevantHistoryRes] = await Promise.all([
				chatStore.queryChatTurns(
					sessionId,
					transformedQuery.queryTexts,
					transformedQuery.filterCriteria,
					undefined,
					INITIAL_QUERY_LIMIT
				),
				loreStore.queryLores(
					characterId,
					transformedQuery.queryTexts,
					transformedQuery.filterCriteria,
					undefined
				),
				historyStore.queryHistories(
					characterId,
					transformedQuery.queryTexts,
					transformedQuery.filterCriteria,
					undefined
				),
			]);

			// Step 1: Apply recency-based re-ranking to chat results
			const rerankedLongTerm = reRankByRecency<ChatTurn>(longTermChatRes);

			// Step 2: Apply critical term boosting to all result types
			const criticalTerm = transformedQuery.criticalTerm;
			const boostedChatTurns = boostByCriticalTerm(rerankedLongTerm.contents || [], criticalTerm);
			const boostedLore = boostByCriticalTerm(relevantLoreRes.loreInfos || [], criticalTerm);
			const boostedHistory = boostByCriticalTerm(relevantHistoryRes.historyInfos || [], criticalTerm);

			// Step 3: Check for low retrieval and apply fallback if needed
			const totalResults = boostedChatTurns.length + boostedLore.length + boostedHistory.length;

			if (totalResults < 3 && criticalTerm) {
				console.log(
					`[memoryEngine] Low results (${totalResults}), trying fallback search with criticalTerm: "${criticalTerm}"`
				);

				const fallbackChatRes = await chatStore.queryChatTurns(
					sessionId,
					[criticalTerm], // Just the critical term
					undefined, // No metadata filtering
					undefined,
					FINAL_MEMORY_LIMIT // Lower limit for fallback
				);

				if (fallbackChatRes.chatTurns?.length > 0) {
					// Merge fallback results with existing ones, avoiding duplicates
					const existingIds = new Set(boostedChatTurns.map((turn) => turn.chatTurnId));
					const newFallbackTurns = fallbackChatRes.chatTurns.filter(
						(turn) => !existingIds.has(turn.chatTurnId)
					);
					boostedChatTurns.push(...newFallbackTurns);
					logFlow('memoryEngine', 'fallback-success', { additionalResults: newFallbackTurns.length });
				}
			}

			// Step 4: Log analysis for debugging and optimization
			logFlow('memoryEngine', 'retrieval-analysis', {
				criticalTerm,
				userInputPreview: userConversation.substring(0, 50) + '...',
				results: {
					longTermChat: boostedChatTurns.length,
					lore: boostedLore.length,
					history: boostedHistory.length,
				},
				finalSelections: {
					longTermSelected: Math.min(boostedChatTurns.length, FINAL_MEMORY_LIMIT),
					loreSelected: boostedLore.length,
					historySelected: boostedHistory.length,
				},
			});

			// Step 5: Return final curated memory response
			return {
				langCode,
				shortTermHistory: recentChatTurns,
				longTermHistory: boostedChatTurns.slice(0, FINAL_MEMORY_LIMIT),
				relevantLore: boostedLore,
				relevantHistory: boostedHistory,
			};
		} catch (error) {
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
	async enrichChatTurnViaLlm(turn: ChatTurn): Promise<ChatTurn> {
		const { sessionId, userId } = turn;
		const { characterId } = parseSessionId(sessionId);

		try {
			// 1. Extract named entities to ensure they are in the glossary.
			const textForNer = `${parseEntriesToConversation(
				turn.request.entries
			)}\n${parseEntriesToConversation(turn.response.entries)}`;
			const extractedKpns = await llmService.extractProperNouns(textForNer, userId);

			// 2. Fetch all necessary context for the enrichment prompt.
			const [profileInfo, charInfo, loreRes, historyRes, termGuidanceMap] = await Promise.all([
				profileStore.getProfileBySessionId(sessionId),
				characterStore.getCharacter(characterId),
				loreStore.getLoresByCharacter(characterId),
				historyStore.getHistories(characterId),
				termStore.ensureAndGetTermsForPrompt(sessionId, userId, extractedKpns),
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

			logFlow('memoryEngine', 'API HIT: enrichChatTurnViaLlm.messages', messages);
			logFlow('memoryEngine', 'API HIT: enrichChatTurnViaLlm.zodSchema', zodSchema);

			const enrichment = await llmService.invokeLlm(
				messages,
				DEFAULT_EXTRACTION_MODEL,
				userId,
				{},
				zodSchema
			);

			logFlow('memoryEngine', 'API HIT: enrichChatTurnViaLlm.enrichment', enrichment);

			// 4. Create the final rich ChatTurn object.
			return _extractChatTurnMetadataInfoFromLlm(turn, JSON.parse(enrichment));
		} catch (error) {
			handleServiceError(error, `Failed to enrich metadata for chatTurn ${turn.chatTurnId}`);
		}
	},
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
