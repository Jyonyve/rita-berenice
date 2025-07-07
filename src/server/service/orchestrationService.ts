// src/server/services/orchestrationService.ts (Updated)

import { ABORT_TIMEOUT, METADATA_TYPES } from '#shared/config/constants.js';
import {
	ChatMessageSet,
	ChatTurn,
	ChatTurnCdo,
	TempChatTurn,
	TempChatTurnCdo,
} from '#shared/domain/chat/ChatInterfaces.js';
import { CharacterInfo } from '#shared/domain/character/CharacterInterfaces.js';

import { chatStore } from '../store/chatStore.js';
import { buildTempChatTurnId } from '../../shared/util/buildIdUtils.js';
import { ApiError, handleServiceError } from '../util/serviceHelpers.js';
import { memoryEngine } from './memoryEngine.js';
import { personaEngine } from './personaEngine.js';
import { AiModelInfo } from '#shared/domain/aimodel/AiInfoTypes.js';
import { buildChatMessage, parseSessionId } from '#shared/util/chatParseUtils.js';
import { ProfileInfo } from '#shared/domain/profile/ProfileInterfaces.js';
import { tempStore } from '../store/tempStore.js';

/**
 * Orchestrates the backend flow for generating a new character response.
 * It fetches context, generates a response, and appends it as a new "option"
 * to the session's temporary turn data, allowing for multiple re-generations.
 * This function does NOT finalize any turns.
 *
 * @param tempChatTurnCdo - Contains the sessionId, sequence, and new user input.
 * @returns A promise resolving to the updated TempChatTurn, including the new response.
 */
export const receiveBotResponse = async (
	tempChatTurnCdo: TempChatTurnCdo,
	characterInfo: CharacterInfo,
	profileInfo: ProfileInfo,
	aiModel: AiModelInfo,
	recentChatTurnString: string
): Promise<TempChatTurn> => {
	const { sequence, sessionId, userInput } = tempChatTurnCdo;
	const overallTimeoutSignal = AbortSignal.timeout(ABORT_TIMEOUT * 1000);

	overallTimeoutSignal.addEventListener('abort', () => {
		console.log(
			`[Orchestrator] Global ${ABORT_TIMEOUT}s timeout triggered for session ${sessionId}.`
		);
	});

	console.log(
		`[Orchestrator] Starting response generation for session ${sessionId}, turn ${sequence}...`
	);

	try {
		let tempTurn: TempChatTurn;
		try {
			tempTurn = (await tempStore.getTempChatTurn(sessionId, sequence)).tempChatTurn;
		} catch (error) {
			if (error instanceof ApiError && error.status === 404) {
				console.log(
					`[Orchestrator] No existing temp turn found. Creating a new one for turn ${sequence}.`
				);
				const now = new Date().toISOString();
				tempTurn = {
					userId: tempChatTurnCdo.userId,
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
				throw error;
			}
		}

		const userChatMessage = buildChatMessage('user', sequence, sessionId, 'User', userInput);
		userChatMessage.showName = profileInfo.showName;

		console.log(`[Orchestrator] Recalling memories for: "${userInput.substring(0, 50)}..."`);
		const recalledMemories = await memoryEngine.recallRelevantMemories(
			sessionId,
			userInput,
			recentChatTurnString
		);

		console.log(`[Orchestrator] Generating new persona response for ${characterInfo.characterId}...`);
		const personaResponse = await personaEngine.generateResponse(
			recalledMemories,
			characterInfo,
			profileInfo,
			userChatMessage,
			aiModel,
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

		const newSet: ChatMessageSet = {
			request: userChatMessage,
			response: botChatMessage,
			setNo: tempTurn.chatTurnSets.length,
		};

		tempTurn.chatTurnSets.push(newSet);
		tempTurn.setCount = tempTurn.chatTurnSets.length;

		await tempStore.saveTempChatTurn(tempTurn);

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

/**
 * Finalizes a temporary chat turn by enriching its metadata via LLM and storing it
 * as a permanent ChatTurn in the main chat history.
 *
 * This function completes the flow for a specific, chosen chat turn.
 *
 * @param chatTurnCdo - The basic information of the chat turn to be finalized (request, response, sequence, sessionId).
 * @returns The fully enriched ChatTurn object after being stored.
 */
export const finalizeChatTurn = async (chatTurnCdo: ChatTurnCdo): Promise<ChatTurn> => {
	const { sessionId, sequence } = chatTurnCdo;
	console.log(`[Orchestrator] Finalizing chat turn for session ${sessionId}, sequence ${sequence}.`);

	try {
		// 1. Enrich the chat turn metadata using the memoryEngine's existing logic
		//    The enrichChatTurnMetadataViaLlm expects a full ChatTurn, so we build one from the Cdo.
		//    Note: You might need to add characterId to ChatTurnCdo if enrichChatTurnMetadataViaLlm uses it.
		const basicChatTurn: ChatTurn = {
			characterId: parseSessionId(sessionId).characterId,
			userId: chatTurnCdo.userId,
			request: chatTurnCdo.request,
			response: chatTurnCdo.response,
			sessionId: chatTurnCdo.sessionId,
			sequence: chatTurnCdo.sequence,
			chatTurnId: '', // Assuming chatStore or a shared util has this
			type: METADATA_TYPES.TURN, // Mark as fixed turn
			createdAt: '',
			updatedAt: '',
			// These will be filled by enrichment or remain empty if not enriched for this field
			summary: '',
			keywords: [],
			topics: [],
			entities: [],
			userEmotion: { primary: 'neutral', intensity: 0.5, nuances: [] },
			characterEmotion: { primary: 'neutral', intensity: 0.5, nuances: [] },
			dialogueAct: 'N/A',
			actions: [],
			relationshipShifts: [],
			flags: [],
			memoryChunk: '',
			loreReferences: [],
			historyReferences: [],
			requestMessageId: '',
			responseMessageId: '',
		};

		const enrichedChatTurn = await memoryEngine.enrichChatTurnViaLlm(basicChatTurn);

		// 2. Store the fully enriched chat turn in the permanent chat history
		await chatStore.storeChatTurn(enrichedChatTurn);

		console.log(
			`[Orchestrator] Chat turn ${sequence} for session ${sessionId} finalized and stored.`
		);
		return enrichedChatTurn;
	} catch (error: any) {
		handleServiceError(
			error,
			`[Orchestrator] Failed to finalize chat turn for session ${sessionId}, sequence ${sequence}.`,
			'An unexpected error occurred while finalizing the chat turn.'
		);
	}
};
