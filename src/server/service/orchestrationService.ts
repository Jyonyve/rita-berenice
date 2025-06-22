// src/server/services/orchestrationService.ts

import {
	TempChatTurn,
	TempChatTurnCdo,
	ChatMessageSet,
	buildChatMessage,
	parseSessionId,
	METADATA_TYPES,
	ApiError,
	ABORT_TIMEOUT,
} from '#shared/index.ts';
import { characterStore, chatStore, profileStore } from '../store/index.ts';
import { handleServiceError } from '../util/serviceHelpers.ts';
import { memoryEngine, personaEngine } from './index.ts';
import { buildTempChatTurnId } from '../util/index.ts';

/**
 * Orchestrates the backend flow for generating a new character response.
 * It fetches context, generates a response, and appends it as a new "option"
 * to the session's temporary turn data, allowing for multiple re-generations.
 * This function does NOT finalize any turns.
 *
 * @param tempChatTurnCdo - Contains the sessionId, sequence, and new user input.
 * @returns A promise resolving to the updated TempChatTurn, including the new response.
 */
export const handleChatRequest = async (
	tempChatTurnCdo: TempChatTurnCdo
): Promise<TempChatTurn> => {
	const { sequence, sessionId, userInput } = tempChatTurnCdo;
	const overallTimeoutSignal = AbortSignal.timeout(ABORT_TIMEOUT * 1000);
	const { characterId } = parseSessionId(sessionId);

	overallTimeoutSignal.addEventListener('abort', () => {
		console.log(
			`[Orchestrator] Global ${ABORT_TIMEOUT}s timeout triggered for session ${sessionId}.`
		);
	});

	console.log(
		`[Orchestrator] Starting response generation for session ${sessionId}, turn ${sequence}...`
	);

	try {
		// --- 1. GET OR CREATE THE TEMPORARY TURN OBJECT ---
		let tempTurn: TempChatTurn;

		try {
			// Attempt to fetch the existing temp turn using its specific ID
			tempTurn = await chatStore.getTempChatTurn(sessionId, sequence);
		} catch (error) {
			// A 404 error here is expected and means this is the first generation for this turn.
			if (error instanceof ApiError && error.status === 404) {
				console.log(
					`[Orchestrator] No existing temp turn found. Creating a new one for turn ${sequence}.`
				);
				const now = new Date().toISOString();
				tempTurn = {
					tempTurnId: buildTempChatTurnId(sessionId, sequence),
					sessionId,
					sequence,
					chatTurnSets: [],
					type: METADATA_TYPES.TEMP,
					createdAt: now,
					updatedAt: now,
					setCount: 0,
					fixedSetNo: -1,
				};
			} else {
				throw error; // Re-throw other unexpected errors
			}
		}

		// --- 2. INITIAL SETUP & LANGUAGE DETECTION ---
		const userChatMessage = buildChatMessage('user', sequence, sessionId, 'User', userInput); // Placeholder showName

		// --- 3. GATHER DATA FOR NEW RESPONSE (in parallel) ---
		const [characterResponse, profileResponse] = await Promise.all([
			characterStore.getCharacter(characterId),
			profileStore.getProfileBySessionId(sessionId),
		]);
		const characterInfo = characterResponse.characterInfo;
		const userInfo = profileResponse.profileInfo;
		userChatMessage.showName = userInfo.showName; // Update with correct name

		// --- 4. RECALL MEMORIES ---
		console.log(`[Orchestrator] Recalling memories for: "${userInput.substring(0, 50)}..."`);
		const recalledMemories = await memoryEngine.recallRelevantMemories(sessionId, userInput);

		// --- 5. GENERATE NEW RESPONSE ---
		console.log(`[Orchestrator] Generating new persona response for ${characterInfo.characterId}...`);
		const personaResponse = await personaEngine.generateResponse(
			recalledMemories,
			characterInfo,
			userInfo,
			userChatMessage,
			{ signal: overallTimeoutSignal }
		);
		const botChatMessage = buildChatMessage(
			'assistant',
			sequence,
			sessionId,
			characterInfo.showName,
			personaResponse.response,
			personaResponse.emotion
		);

		// --- 6. UPDATE AND SAVE THE TEMP TURN ---
		// Create the new request-response pair (a new potential "option" for this turn)
		const newSet: ChatMessageSet = {
			request: userChatMessage,
			response: botChatMessage,
			setNo: tempTurn.chatTurnSets.length,
		};

		// Add the new option to the list of available sets for this turn
		tempTurn.chatTurnSets.push(newSet);

		// Update the metadata before saving
		tempTurn.setCount = tempTurn.chatTurnSets.length;

		await chatStore.saveTempChatTurn(tempTurn);

		// --- 7. RETURN THE UPDATED TEMP TURN TO THE CLIENT ---
		console.log(
			`[Orchestrator] Request for turn ${sequence} completed. Temp turn now has ${tempTurn.setCount} options.`
		);
		return tempTurn;
	} catch (error: any) {
		handleServiceError(
			error,
			`[Orchestrator] Failed to process chat request for session ${sessionId}, turn ${sequence}.`,
			'An unexpected error occurred while processing the request.'
		);
	}
};
