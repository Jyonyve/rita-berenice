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
	METADATA_GENERATION_MODEL,
} from '#shared/index.ts';
import { handleServiceError } from '../util/serviceHelpers.ts';
import { buildChatTurnMetadataPrompt } from '../util/templateUtils.ts';
import { characterService, llmService, loreService, profileService, termService } from './index.ts'; // Centralized service imports

// --- 2. Corrected and Renamed Metadata Creation Helper ---
/**
 * Safely merges the original ChatTurn with the LLM enrichment data and then
 * uses the existing utility to convert it to the final ChatTurnMetadata format for storage.
 * @param turn The original ChatTurn object.
 * @param enrichment The parsed JSON object from the LLM.
 * @returns A valid ChatTurnMetadata object.
 */
function _createMetadataFromEnrichment(
	turn: ChatTurn,
	enrichment: Record<string, any>
): ChatTurnMetadata {
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
	return chatTurnToMetadata(tempEnrichedTurn);
}

export const memoryEngine = {
	/**
	 * Takes a chat turn, enriches it with LLM-generated metadata, and populates the `enrichedMetadata` field.
	 * This process includes term standardization using the session glossary.
	 */
	async enrichChatTurnMetadataViaLlm(turn: ChatTurn): Promise<ChatTurnMetadata> {
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
			const termGuidanceMap = await termService.ensureAndGetTermsForPrompt(sessionId, extractedKpns);

			// 3. Fetch context (lore, history, user/char info)
			const [userInfo, charInfo, loreRes, historyRes] = await Promise.all([
				profileService.getProfileBySessionId(sessionId),
				characterService.getCharacter(characterId),
				loreService.getLores(characterId),
				loreService.getHistories(characterId),
			]);
			const loreIds = loreRes.lores.map((lore) => lore.loreId);
			const historyIds = historyRes.histories.map((history) => history.historyId);

			// 4. Build the guided prompt for the LLM
			const prompt = buildChatTurnMetadataPrompt(
				userInfo.basicProfileInfo,
				turn.request,
				charInfo.basicCharacterInfo,
				turn.response,
				loreIds,
				historyIds,
				termGuidanceMap
			);

			// 5. Call the LLM and robustly parse the JSON response
			const llmResponse = await llmService.invokeLlm('user', prompt, METADATA_GENERATION_MODEL);
			const enrichment = memoryEngine.parseLlmJsonResponse(llmResponse);

			// 6. Create the final metadata object using your utility
			return _createMetadataFromEnrichment(turn, enrichment);
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [enrichChatTurnMetadataViaLlm].',
				`Failed to enrich chat turn metadata for chatTurn ${turn.chatTurnId}:`
			);
		}
	},

	/**
	 * Parses a string that might contain a JSON object, potentially wrapped in markdown.
	 * @param llmResponse The raw string response from the LLM.
	 * @returns A parsed object, or an empty object if parsing fails.
	 */
	parseLlmJsonResponse: (llmResponse: string): Record<string, any> => {
		if (!llmResponse) return {};
		const JSON_REGEX = /``````|({[\s\S]*?})/;

		const match = llmResponse.match(JSON_REGEX);
		// The desired JSON will be in one of the capturing groups.
		const extractedJson = match?.[1] || match?.[2];

		if (!extractedJson) {
			console.error('MemoryEngine: No valid JSON object found in LLM response.', {
				response: llmResponse,
			});
			return {};
		}

		try {
			return JSON.parse(extractedJson);
		} catch (error) {
			console.error('MemoryEngine: Failed to parse extracted JSON.', { json: extractedJson, error });
			return {};
		}
	},
};
