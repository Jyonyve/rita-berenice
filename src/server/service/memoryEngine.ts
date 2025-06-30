// src/server/services/memoryEngine.ts

import {
	ChatTurn,
	parseSessionId,
	BasicBeingInfo,
	parseEntriesToText,
	ChatTurnMetadata,
	METADATA_TYPES,
	chatTurnToMetadata,
	AiModelInfo,
	DEFAULT_MODEL_GOOGLEAI,
	RecapInfo,
	convertArrayToString,
	MemoryResponse,
} from '#shared/index.js';
import {
	characterStore,
	chatStore,
	loreStore,
	profileStore,
	recapStore,
	termStore,
} from '../store/index.js';

import { detectLanguage, handleServiceError, parseLlmJsonResponse } from '../util/index.js';
import { buildChatTurnMetadataPrompt } from '../util/templateUtils.js';
import { llmService } from './index.js'; // Centralized service imports

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
	return `[Recap from turns ${recap.turnStart}-${recap.turnEnd}]${flags} Summary: ${recap.content.substring(0, 150)}...`; // Use a snippet of the content as a summary
}

export const memoryEngine = {
	/**
	 * Gathers all relevant context (memories) needed to generate a coherent, in-character response.
	 * This is the primary "recall" step using a multi-tiered memory approach.
	 * @param sessionId The current session ID.
	 * @param userRequestText The text from the user's latest prompt for semantic search.
	 * @returns A MemoryRecallPayload object containing various forms of context.
	 */
	async recallRelevantMemories(sessionId: string, userRequestText: string): Promise<MemoryResponse> {
		const { characterId } = parseSessionId(sessionId);
		const MEMORY_LIMIT = 3; // Limit for long-term and recap queries
		const langCode = detectLanguage(userRequestText);
		try {
			const [
				shortTermHistoryRes,
				longTermHistoryRes,
				relevantLoreRes,
				relevantHistoryRes,
				// --- KEY CHANGE: Query for relevant recaps, not the latest one ---
				relevantFactualRecapsRes,
				relevantRelationshipRecapsRes,
			] = await Promise.all([
				// Tier 1: Immediate context
				chatStore.getChatTurns(sessionId, 5),
				// Tier 2: Specific past conversations
				chatStore.queryChatTurns(sessionId, [userRequestText]),
				// Foundational truths and chronological background
				loreStore.queryLores(characterId, [userRequestText]),
				loreStore.queryHistories(characterId, [userRequestText]),
				// Tier 3: Narrative milestones
				recapStore.queryRecaps(sessionId, [userRequestText], METADATA_TYPES.RECAP),
				recapStore.queryRecaps(sessionId, [userRequestText], METADATA_TYPES.RELATIONSHIP),
			]);

			// Construct a concise, token-friendly summary of the recalled recaps
			const factualRecapSummary = relevantFactualRecapsRes?.recapInfos
				.map(_formatRecapForPrompt)
				.join('\n');

			const relationshipRecapSummary = relevantRelationshipRecapsRes?.recapInfos
				.map(_formatRecapForPrompt)
				.join('\n');

			return {
				langCode,
				shortTermHistory: shortTermHistoryRes?.chatTurns || [],
				longTermHistory: longTermHistoryRes?.chatTurns || [],
				relevantLore: relevantLoreRes?.lores || [],
				relevantHistory: relevantHistoryRes?.histories || [],
				// Pass the concise summaries, not the full objects
				factualRecapSummary: factualRecapSummary,
				relationshipRecapSummary: relationshipRecapSummary,
			};
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [recallRelevantMemories].',
				`Failed to recall relevant memories ${userRequestText.substring(0, 30)}...`
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
			const extractedKpns = await llmService.extractProperNouns(textForNer);

			// 2. Ensure terms are in the glossary and get the guidance map
			const termGuidanceMap = await termStore.ensureAndGetTermsForPrompt(sessionId, extractedKpns);

			// 3. Fetch context (lore, history, user/char info)
			const [profileInfo, charInfo, loreRes, historyRes] = await Promise.all([
				profileStore.getProfileBySessionId(sessionId),
				characterStore.getCharacter(characterId),
				loreStore.getLores(characterId),
				loreStore.getHistories(characterId),
			]);
			const loreIds = loreRes.lores.map((lore) => lore.loreId);
			const historyIds = historyRes.histories.map((history) => history.historyId);

			// 4. Build the guided prompt for the LLM
			const prompt = buildChatTurnMetadataPrompt(
				profileInfo.profileInfo,
				turn.request,
				charInfo.characterInfo,
				turn.response,
				loreIds,
				historyIds,
				termGuidanceMap
			);

			// 5. Call the LLM and robustly parse the JSON response
			const llmResponse = await llmService.invokeLlm('user', prompt, DEFAULT_MODEL_GOOGLEAI);
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
