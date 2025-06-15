// src/server/services/orchestrationService.ts

import {
	ChatTurn,
	parseSessionId,
	TempChatTurn,
	TempChatTurnCdo,
	buildChatMessage,
} from '#shared/index.ts';
import { handleServiceError } from '../util/serviceHelpers.ts';
import {
	chatService,
	characterService,
	profileService,
	memoryEngine,
	personaEngine,
} from './index.ts';

/**
 * Orchestrates the entire backend flow for handling a single user chat request.
 * It coordinates memory recall, response generation, and metadata enrichment.
 *
 * @param sessionId - The unique identifier for the current chat session.
 * @param chatTurnCdo - The Chat Turn Create Data Object, containing the user's request.
 * @returns A promise that resolves to the final, generated ChatMessage for the user.
 * @throws {ApiError} - Throws specific API errors on failure, which are handled by Express middleware.
 */
export const handleChatRequest = async (
	tempChatTurnCdo: TempChatTurnCdo
): Promise<TempChatTurn> => {
	const { sequence, sessionId, userInput } = tempChatTurnCdo;
	// --- 1. SET GLOBAL TIMEOUT & CONTEXT ---
	// A total budget of 15 seconds for the entire operation.
	const overallTimeoutSignal = AbortSignal.timeout(15000);
	const { characterId } = parseSessionId(sessionId);

	overallTimeoutSignal.addEventListener('abort', () => {
		console.log(`[Orchestrator] Global 15s timeout triggered for session ${sessionId}.`);
	});

	console.log(`[Orchestrator] Starting chat request for session ${sessionId}, turn ${sequence}...`);

	try {
		// --- 2. INITIAL DATA GATHERING (in parallel) ---
		const [characterResponse, profileResponse] = await Promise.all([
			characterService.getCharacter(characterId),
			profileService.getProfileBySessionId(sessionId),
		]);
		const profileInfo = profileResponse.profileInfo;
		const characterInfo = characterResponse.characterInfo;
		const userChatMessage = buildChatMessage(
			'user',
			sequence,
			sessionId,
			profileInfo.showName,
			userInput
		);
		// --- 3. RECALL: Gather all relevant memories ---
		console.log(`[Orchestrator] Recalling memories for: "${userInput.substring(0, 50)}..."`);
		const recalledMemories = await memoryEngine.recallRelevantMemories(sessionId, userInput);

		// --- 4. GENERATE: Create the character's response (in Korean) ---
		console.log(
			`[Orchestrator] Generating persona response for ${characterResponse.characterInfo.name}...`
		);
		const personaResponse = await personaEngine.generateResponse(
			recalledMemories,
			characterInfo,
			profileInfo,
			userChatMessage,
			{ signal: overallTimeoutSignal }
		);

		// --- 5. BUILD & ENRICH: Construct the final turn object and add metadata (in English) ---
		console.log(`[Orchestrator] Building final turn and enriching metadata...`);
		const completedTurn: ChatTurn = chatService.createTurnFromCdo(
			chatTurnCdo,
			personaResponse, // Contains the Korean response text and English emotion
			characterId
		);

		// The enrichment process is critical for future memory but can happen after the response is sent.
		// For simplicity and immediate consistency, we do it here. For performance, this could be a fire-and-forget task.
		const enrichedMetadata = await memoryEngine.enrichChatTurnMetadataViaLlm(completedTurn);

		completedTurn.enrichedMetadata = enrichedMetadata;

		// --- 6. STORE: Save the final, completed, and enriched turn to the database ---
		console.log(`[Orchestrator] Storing final chat turn ${completedTurn.sequence}...`);
		await chatService.storeChatTurn(completedTurn);

		// --- 7. RETURN: Send the generated response message back to the client ---
		console.log(`[Orchestrator] Request for turn ${completedTurn.sequence} completed successfully.`);
		return completedTurn.response;
	} catch (error: any) {
		// Your robust error handling utility takes care of everything.
		// It will correctly re-throw ApiError subtypes (like LlmResponseParseError)
		// and wrap any unexpected errors in a generic 500 ApiError.
		handleServiceError(
			error,
			`[Orchestrator] Failed to process chat request for session ${sessionId}.`,
			'An unexpected error occurred while processing the request.' // Generic fallback client message
		);
	}
};
