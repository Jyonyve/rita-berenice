// src/server/services/memoryEngine.ts

import {
	ChatTurn,
	ChatMessage,
	METADATA_TYPES,
	parseSessionId,
	// Assuming you have a way to get user/char gender and existing lore/history IDs
	// For example, from a profileService or characterService
} from '#shared/index.ts';
import { buildChatTurnMetadataPrompt } from '../util/templateUtils.ts'; // Or memoryTemplateUtils.ts
import { characterService } from './characterService.ts';
import { callLlmApi } from './llmService.ts'; // A generic LLM API calling service
import { profileService } from './profileService.ts';

// Placeholder for fetching existing Lore/History IDs for relevance linking
const getExistingLoreIds = async (characterId: string): Promise<string[]> => {
	// TODO: Implement this. Query LoreCollection for characterId
	return ['Syndicate_Lore', 'Ancient_Scroll_Info']; // Placeholder
};
const getExistingHistoryIds = async (characterId: string): Promise<string[]> => {
	// TODO: Implement this. Query HistoryCollection for characterId
	return ['Battle_of_Yorn', 'Coronation_Event']; // Placeholder
};

const parseLlmJsonResponse = (jsonString: string): Partial<ChatTurn> => {
	try {
		const parsed = JSON.parse(jsonString);
		// TODO: Add schema validation here against EnrichedChatTurnMetadata structure
		// For now, we assume the LLM returns the correct structure.
		return parsed;
	} catch (error) {
		console.error(
			'MemoryEngine: Failed to parse LLM JSON response:',
			error,
			'\nResponse was:',
			jsonString
		);
		// Return a structure with default/error values or throw
		return {}; // Or throw new Error("Invalid JSON from LLM");
	}
};

// Default values for EnrichedChatTurnMetadata
const getDefaultEnrichedMetadata = (turn: ChatTurn): EnrichedChatTurnMetadata => ({
	sessionId: turn.sessionId,
	sequence: turn.sequence,
	chatTurnId: turn.chatTurnId,
	turnSummary: 'N/A',
	keyEntities: [],
	extractedTopics: [],
	userEmotionalTone: { primary: 'neutral', intensity: 0.5, nuances: [] },
	characterEmotionalTone: { primary: 'neutral', intensity: 0.5, nuances: [] },
	relationshipDynamicsShift: [],
	dialogueAct: 'N/A',
	keyActionsDescribed: [],
	loreReferences: [],
	historyReferences: [],
	triggerFlags: [],
	memoryChunk: 'No specific memory chunk generated for this turn.',
	// ChromaDB required fields if EnrichedChatTurnMetadata is also a top-level collection type
	type: METADATA_TYPES.TURN, // Define this in your METADATA_TYPES
});

export const memoryEngine = {
	/**
	 * Enriches a ChatTurn with detailed metadata using an LLM.
	 * @param turn The ChatTurn object (containing request and response)
	 * @returns The ChatTurn object with an added 'enrichedMetadata' field.
	 */
	enrichChatTurn: async (turn: ChatTurn): Promise<ChatTurn> => {
		console.log(`MemoryEngine: Enriching turn ${turn.sequence} for session ${turn.sessionId}`);
		const characterId = parseSessionId(turn.sessionId).characterId;
		// Fetch participant info (placeholders for now)
		const userInfo = await profileService.getProfileBySessionId(turn.sessionId);
		const charInfo = await characterService.getCharacter(characterId);

		// Fetch existing lore/history IDs for context (placeholders for now)
		const loreIds = await getExistingLoreIds(characterId); // Assuming characterId on response
		const historyIds = await getExistingHistoryIds(turn.response.characterId || charInfo.name);

		const prompt = buildChatTurnMetadataPrompt(
			userInfo.name,
			userInfo.gender,
			turn.request,
			charInfo.name,
			charInfo.gender,
			turn.response,
			loreIds,
			historyIds
		);

		try {
			// Use a specific LLM for this task, maybe a faster/cheaper one if available
			// Or use the same as your character's response LLM
			const llmApiResponse = await callLlmApi(prompt, { modelName: 'gemini-2.0-flash-001' }); // Example model

			if (!llmApiResponse || llmApiResponse.trim() === '') {
				console.warn(
					`MemoryEngine: LLM returned empty response for turn ${turn.sequence}. Using defaults.`
				);
				turn.enrichedMetadata = getDefaultEnrichedMetadata(turn);
				return turn;
			}

			// Attempt to clean up if LLM includes ``````
			let jsonResponseString = llmApiResponse;
			const jsonRegex = /``````/;
			const match = jsonRegex.exec(llmApiResponse);
			if (match && match[1]) {
				jsonResponseString = match[1];
			}

			const parsedMetadata = parseLlmJsonResponse(jsonResponseString);

			// Merge with defaults to ensure all fields are present
			turn.enrichedMetadata = {
				...getDefaultEnrichedMetadata(turn),
				...parsedMetadata,
				// Ensure core IDs from the original turn are preserved
				sessionId: turn.sessionId,
				sequence: turn.sequence,
				chatTurnId: turn.chatTurnId,
			};

			console.log(
				`MemoryEngine: Successfully enriched turn ${turn.sequence}. Memory Chunk: "${turn.enrichedMetadata.memoryChunk.substring(0, 50)}..."`
			);
		} catch (error) {
			console.error(`MemoryEngine: Error enriching turn ${turn.sequence}:`, error);
			// On error, still populate with default metadata so the ChatTurn structure is consistent
			turn.enrichedMetadata = getDefaultEnrichedMetadata(turn);
		}

		return turn;
	},
};
