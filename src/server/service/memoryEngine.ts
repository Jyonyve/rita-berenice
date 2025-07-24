// src/server/services/memoryEngine.ts

import { METADATA_TYPES } from '#shared/config/constants.js';

import { buildChatTurnMetadataPrompt } from '../util/templateUtils.js';
import { ChatTurn } from '#shared/domain/chat/ChatInterfaces.js';
import { RecapInfo } from '#shared/domain/recap/RecapInterfaces.js';
import {
	convertArrayToString,
	parseEntriesToText,
	parseSessionId,
} from '#shared/util/chatParseUtils.js';
import { MemoryResponse } from '#shared/api/ModuleResponse.js';
import { recapStore } from '../store/recapStore.js';
import { characterStore } from '../store/characterStore.js';
import { chatStore } from '../store/chatStore.js';
import { loreStore } from '../store/loreStore.js';
import { profileStore } from '../store/profileStore.js';
import { termStore } from '../store/termStore.js';
import { detectLanguage } from '../util/languageUtils.js';
import { handleServiceError } from '../util/serviceHelpers.js';
import { parseLlmJsonResponse, reRankByRecency } from '../util/llmUtils.js';
import { llmService } from './llmService.js';
import { AiModelInfo, DEFAULT_CHAT_MODEL_FREE } from '#shared/domain/aimodel/AiInfoTypes.js';
import { ragQueryService } from './ragQueryService.js';
import { WhereDocument } from 'chromadb';

// --- 2. Corrected and Renamed Metadata Creation Helper ---
/**
 * Safely merges the original ChatTurn with the LLM enrichment data and then
 * uses the existing utility to convert it to the final ChatTurnMetadata format for storage.
 * @param turn The original ChatTurn object.
 * @param enrichment The parsed JSON object from the LLM.
 * @returns A valid ChatTurnMetadata object.
 */
function _extractChatTurnMetadataInfoFromLlm(
	turn: ChatTurn,
	enrichment: Record<string, any>
): ChatTurn {
	// Create a temporary ChatTurn object with rich types (arrays, objects)
	const tempEnrichedTurn: ChatTurn = {
		...turn,
		summary: enrichment.summary || '',
		keywords: Array.isArray(enrichment.keywords) ? enrichment.keywords : [],
		topics: Array.isArray(enrichment.topics) ? enrichment.topics : [],
		entities: Array.isArray(enrichment.entities) ? enrichment.entities : [],
		userEmotion: {
			primary: enrichment.userEmotion?.primary || 'neutral',
			intensity: enrichment.userEmotion?.intensity ?? 0.5,
			nuances: Array.isArray(enrichment.userEmotion?.nuances) ? enrichment.userEmotion.nuances : [],
		},
		characterEmotion: {
			primary: enrichment.characterEmotion?.primary || 'neutral',
			intensity: enrichment.characterEmotion?.intensity ?? 0.5,
			nuances: Array.isArray(enrichment.characterEmotion?.nuances)
				? enrichment.characterEmotion.nuances
				: [],
		},
		dialogueAct: enrichment.dialogueAct || 'N/A',
		actions: Array.isArray(enrichment.actions) ? enrichment.actions : [],
		relationshipShifts: Array.isArray(enrichment.relationshipShifts)
			? enrichment.relationshipShifts
			: [],
		flags: Array.isArray(enrichment.flags) ? enrichment.flags : [],
		memoryChunk: enrichment.memoryChunk || '',
		loreReferences: Array.isArray(enrichment.loreReferences) ? enrichment.loreReferences : [],
		historyReferences: Array.isArray(enrichment.historyReferences)
			? enrichment.historyReferences
			: [],
	};

	// Use your existing, trusted utility to serialize the rich object into DB-compatible metadata
	return tempEnrichedTurn;
}

function _formatRecapForPrompt(recap: RecapInfo): string {
	const flags =
		recap.flagsArray.length > 0 ? ` [FLAGS: ${convertArrayToString(recap.flagsArray)}]` : '';
	return `[Recap from turns ${recap.turnStart}-${recap.turnEnd}]${flags} Summary: ${recap.content}...`; // Use a snippet of the content as a summary
}

export const memoryEngine = {
	/**
	 * Gathers all relevant context (memories) needed to generate a coherent, in-character response.
	 * This is the primary "recall" step using a multi-tiered memory approach.
	 * @param sessionId The current session ID.
	 * @param userInput The text from the user's latest prompt for semantic search.
	 * @returns A MemoryRecallPayload object containing various forms of context.
	 */
	async recallRelevantMemories(
		sessionId: string,
		userInput: string,
		userId: string,
		recentChatTurns: string,
		aiModelInfo: AiModelInfo
	): Promise<MemoryResponse> {
		const { characterId } = parseSessionId(sessionId);
		const INITIAL_QUERY_LIMIT = 30;
		const FINAL_MEMORY_LIMIT = 10;
		const langCode = detectLanguage(userInput);

		try {
			const transformedQuery = await ragQueryService.transformQuery(
				userInput,
				aiModelInfo,
				userId,
				langCode
			);

			let documentFilter: WhereDocument | undefined = undefined;
			const quotedTextMatch = userInput.match(/"(.*?)"/);
			if (quotedTextMatch && quotedTextMatch[1]) {
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

			const shortTermHistory: ChatTurn[] = JSON.parse(recentChatTurns) ?? [];
			const rerankedLongTerm = reRankByRecency<ChatTurn>(longTermChatRes);
			// Construct a concise, token-friendly summary of the recalled recaps
			const factualRecapSummary = relevantFactualRecapsRes?.recapInfos
				.map(_formatRecapForPrompt)
				.join('\n');

			const relationshipRecapSummary = relevantRelationshipRecapsRes?.recapInfos
				.map(_formatRecapForPrompt)
				.join('\n');

			return {
				langCode,
				shortTermHistory,
				longTermHistory: rerankedLongTerm.contents?.slice(0, FINAL_MEMORY_LIMIT) || [],
				relevantLore: relevantLoreRes?.loreInfos || [],
				relevantHistory: relevantHistoryRes?.historyInfos || [],
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
		const { sessionId } = turn;
		const { characterId } = parseSessionId(sessionId);

		try {
			// 1. Extract NER terms from the conversation text
			const textForNer = [
				parseEntriesToText(turn.request.entries),
				parseEntriesToText(turn.response.entries),
			].join('\n');
			const extractedKpns = await llmService.extractProperNouns(textForNer, turn.userId);

			// 2. Ensure terms are in the glossary and get the guidance map
			const termGuidanceMap = await termStore.ensureAndGetTermsForPrompt(
				sessionId,
				turn.userId,
				extractedKpns
			);

			// 3. Fetch context (lore, history, user/char info)
			const [profileInfo, charInfo, loreRes, historyRes] = await Promise.all([
				profileStore.getProfileBySessionId(sessionId),
				characterStore.getCharacter(characterId),
				loreStore.getLores(characterId),
				loreStore.getHistories(characterId),
			]);
			const loreIds = loreRes.loreInfos.map((lore) => lore.loreId);
			const historyIds = historyRes.historyInfos.map((history) => history.historyId);

			// 4. Build the guided prompt for the LLM
			const prompt = buildChatTurnMetadataPrompt(
				profileInfo.profileInfo,
				turn.request,
				charInfo.characterInfo,
				turn.response,
				termGuidanceMap
			);

			// 5. Call the LLM and robustly parse the JSON response
			const llmResponse = await llmService.invokeLlm(
				[
					{ role: 'system', content: 'You are a helpful assistant.' },
					{ role: 'user', content: prompt },
				],
				DEFAULT_CHAT_MODEL_FREE,
				turn.userId
			);
			const enrichment = parseLlmJsonResponse<Record<string, any>>(llmResponse);

			// 6. Create the final metadata object using your utilityd
			return _extractChatTurnMetadataInfoFromLlm(turn, enrichment);
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [extractChatTurnMetadataInfoFromLlm].',
				`Failed to enrich chat turn metadata for chatTurn ${turn.chatTurnId}:`
			);
		}
	},
};
