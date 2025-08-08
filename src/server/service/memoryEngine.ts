// src/server/services/memoryEngine.ts

import { METADATA_TYPES, NA } from '#shared/config/constants.js';

import { buildChatTurnMetadataPrompt } from '../util/templateUtils.js';
import { ChatTurn } from '#shared/domain/chat/ChatInterfaces.js';
import { RecapInfo } from '#shared/domain/recap/RecapInterfaces.js';
import {
	convertArrayToString,
	parseEntriesToText,
	parseSessionId,
} from '#shared/util/parseUtils.js';
import { MemoryResponse } from '#shared/api/ModuleResponse.js';
import { recapStore } from '../store/recapStore.js';
import { characterStore } from '../store/characterStore.js';
import { chatStore } from '../store/chatStore.js';
import { loreStore } from '../store/loreStore.js';
import { profileStore } from '../store/profileStore.js';
import { termStore } from '../store/termStore.js';
import { detectLanguage } from '../util/languageUtils.js';
import { handleServiceError } from '../util/serviceHelpers.js';
import { mapLoreContexts, reRankByRecency, mapHistoryContexts } from '../util/llmUtils.js';
import { llmService } from './llmService.js';
import { DEFAULT_EXTRACTION_MODEL } from '#shared/domain/aimodel/AiInfoTypes.js';
import { ragQueryService } from './ragQueryService.js';
import { WhereDocument } from 'chromadb';
import { createChatTurnMetadataSchema } from '#server/util/schemaUtils.js';
import { ChatCompletionMessageParam } from 'openai/resources/index.mjs';
import { DEFAULT_EMOTION } from '#shared/config/emotionWordsMapper.js';
import { logFlow } from '../util/jsonlLogger.js';

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

export const memoryEngine = {
	/**
	 * Gathers all relevant context (memories) needed to generate a coherent, in-character response.
	 */
	async recallRelevantMemories(
		sessionId: string,
		userInput: string,
		userId: string,
		recentChatTurns: ChatTurn[]
	): Promise<MemoryResponse> {
		const { characterId } = parseSessionId(sessionId);
		const INITIAL_QUERY_LIMIT = 30;
		const FINAL_MEMORY_LIMIT = 10;
		const langCode = detectLanguage(userInput);

		try {
			const transformedQuery = await ragQueryService.transformQuery(userInput, userId, langCode);
			logFlow('ragQueryService', 'API HIT: transformQuery', { transformedQuery });

			let documentFilter: WhereDocument | undefined = undefined;
			const quotedTextMatch = userInput.match(/"(.*?)"/);
			if (quotedTextMatch?.[1]) {
				documentFilter = { $contains: quotedTextMatch[1] };
			}
			const [
				longTermChatRes,
				relevantLoreRes,
				relevantHistoryRes,
				relevantFactualRecapsRes,
				relevantRelationshipRecapsRes,
			] = await Promise.all([
				chatStore.queryChatTurns(
					sessionId,
					transformedQuery.queryTexts,
					transformedQuery.metadataFilter,
					documentFilter,
					INITIAL_QUERY_LIMIT
				),
				loreStore.queryLores(
					characterId,
					transformedQuery.queryTexts,
					transformedQuery.metadataFilter,
					documentFilter
				),
				loreStore.queryHistories(
					characterId,
					transformedQuery.queryTexts,
					transformedQuery.metadataFilter,
					documentFilter
				),
				recapStore.queryRecaps(
					sessionId,
					transformedQuery.queryTexts,
					METADATA_TYPES.RECAP,
					transformedQuery.metadataFilter,
					documentFilter
				),
				recapStore.queryRecaps(
					sessionId,
					transformedQuery.queryTexts,
					METADATA_TYPES.RELATIONSHIP,
					transformedQuery.metadataFilter,
					documentFilter
				),
			]);

			const rerankedLongTerm = reRankByRecency<ChatTurn>(longTermChatRes);

			const factualRecapSummary = relevantFactualRecapsRes.map(_formatRecapForPrompt).join('\n') || '';
			const relationshipRecapSummary =
				relevantRelationshipRecapsRes.map(_formatRecapForPrompt).join('\n') || '';

			logFlow('memoryEngine', 'API HIT: longTermChatRes', longTermChatRes);
			logFlow('memoryEngine', 'API HIT: relevantLoreRes', relevantLoreRes.ids);
			logFlow('memoryEngine', 'API HIT: relevantHistoryRes', relevantHistoryRes.ids);
			logFlow('memoryEngine', 'API HIT: relevantFactualRecapsRes', relevantFactualRecapsRes);
			logFlow('memoryEngine', 'API HIT: relevantRelationshipRecapsRes', relevantRelationshipRecapsRes);

			return {
				langCode,
				shortTermHistory: recentChatTurns,
				longTermHistory: rerankedLongTerm.contents?.slice(0, FINAL_MEMORY_LIMIT) || [],
				relevantLore: relevantLoreRes.loreInfos || [],
				relevantHistory: relevantHistoryRes.historyInfos || [],
				factualRecapSummary,
				relationshipRecapSummary,
			};
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [recallRelevantMemories].',
				`Failed to recall relevant memories ${userInput.substring(0, 30)}...`
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
			const textForNer = `${parseEntriesToText(turn.request.entries)}\n${parseEntriesToText(turn.response.entries)}`;
			const extractedKpns = await llmService.extractProperNouns(textForNer, userId);

			// 2. Fetch all necessary context for the enrichment prompt.
			const [profileInfo, charInfo, loreRes, historyRes, termGuidanceMap] = await Promise.all([
				profileStore.getProfileBySessionId(sessionId),
				characterStore.getCharacter(characterId),
				loreStore.getLores(characterId),
				loreStore.getHistories(characterId),
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
