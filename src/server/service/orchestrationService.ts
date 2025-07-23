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
import { buildProfileId, buildTempChatTurnId } from '../../shared/util/buildIdUtils.js';
import { ApiError, handleServiceError } from '../util/serviceHelpers.js';
import { memoryEngine } from './memoryEngine.js';
import { personaEngine } from './personaEngine.js';
import { AiModelInfo } from '#shared/domain/aimodel/AiInfoTypes.js';
import { buildChatMessage, parseSessionId } from '#shared/util/chatParseUtils.js';
import { ProfileInfo } from '#shared/domain/profile/ProfileInterfaces.js';
import { tempStore } from '../store/tempStore.js';
import { MemoryResponse, PersonaResponse } from '#shared/api/ModuleResponse.js';
import { detectLanguage } from '../util/languageUtils.js';

/**
 * FINAL VERSION:
 * 클라이언트가 호출하는 메인 엔드포인트.
 * 타임아웃 및 성능 측정과 같은 전체적인 흐름을 관리하고,
 * 세부 로직은 내부 헬퍼 함수에 위임합니다.
 */
export const receiveBotResponse = async (
	tempChatTurnCdo: TempChatTurnCdo,
	characterInfo: CharacterInfo,
	profileInfo: ProfileInfo,
	aiModelInfo: AiModelInfo,
	recentChatTurnString: string
): Promise<TempChatTurn> => {
	const startTime = performance.now();
	const { sequence, sessionId, userInput } = tempChatTurnCdo;

	const controller = new AbortController();
	const timeoutId = setTimeout(() => {
		console.log(
			`[Orchestrator] Global ${ABORT_TIMEOUT}s timeout triggered for session ${sessionId}.`
		);
		controller.abort();
	}, ABORT_TIMEOUT * 1000);

	console.log(
		`[Orchestrator: ${aiModelInfo.model}] Starting response generation for session ${sessionId}, turn ${sequence}...`
	);

	try {
		// 1. 턴 가져오기 또는 생성
		let tempTurn = await _getOrCreateTempTurn(sessionId, sequence, tempChatTurnCdo.userId);

		// 2. 새로운 응답 생성 및 추가 (책임 위임)
		tempTurn = await _generateAndAppendResponse(
			tempTurn,
			userInput,
			characterInfo,
			profileInfo,
			aiModelInfo,
			recentChatTurnString,
			{ signal: controller.signal }
		);

		// 3. 최종 상태 저장
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
	} finally {
		clearTimeout(timeoutId);

		const endTime = performance.now();
		const durationInMs = endTime - startTime;
		const durationInSec = (durationInMs / 1000).toFixed(2);
		console.log(
			`[Orchestrator] Execution of receiveBotResponse for session ${sessionId} completed in ${durationInSec} seconds.`
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
			profileId: buildProfileId(chatTurnCdo.sessionId, chatTurnCdo.userId),
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

/**
 * [HELPER] Retrieves an existing TempChatTurn or creates a new one if it doesn't exist.
 * This function now uses error handling to manage the control flow.
 * @private
 */
const _getOrCreateTempTurn = async (
	sessionId: string,
	sequence: number,
	userId: string
): Promise<TempChatTurn> => {
	try {
		// 1. Attempt to fetch the TempChatTurn.
		// getTempChatTurn will now throw an ApiError with status 404 if not found.
		const response = await tempStore.getTempChatTurn(sessionId, sequence);
		console.log(`[Orchestrator] Existing temp turn found for turn ${sequence}.`);
		// Assuming the response object contains the turn, e.g., { tempChatTurn: ... }
		return response.tempChatTurn;
	} catch (error: any) {
		// 2. Check if the error is the specific "Not Found" error.
		if (error instanceof ApiError && error.status === 404) {
			// 3. If it is a 404, the turn doesn't exist. Create a new one.
			console.log(`[Orchestrator] No existing temp turn found. Creating new for turn ${sequence}.`);
			const now = new Date().toISOString();
			return {
				userId,
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
			// 4. For any other error (e.g., 500), re-throw it to be handled by the caller.
			console.error(`[Orchestrator] An unexpected error occurred in _getOrCreateTempTurn:`, error);
			throw error;
		}
	}
};
// In src/server/services/orchestrationService.ts

/**
 * [HELPER] Generates a new AI response and adds it to the temp turn's options.
 * This is the core business logic for a single response generation.
 * @private
 */
async function _generateAndAppendResponse(
	tempTurn: TempChatTurn,
	userInput: string,
	characterInfo: CharacterInfo,
	profileInfo: ProfileInfo,
	aiModelInfo: AiModelInfo,
	recentChatTurnString: string,
	options: { signal?: AbortSignal }
): Promise<TempChatTurn> {
	// 1. Recall relevant memories for context.
	let recalledMemories: MemoryResponse;
	try {
		recalledMemories = await memoryEngine.recallRelevantMemories(
			tempTurn.sessionId,
			userInput,
			recentChatTurnString
		);
	} catch (error: any) {
		if (error instanceof ApiError && error.status === 404) {
			console.warn(`[Orchestrator] No memories found for session. Proceeding with empty context.`);
			recalledMemories = {
				langCode: detectLanguage(userInput),
				shortTermHistory: JSON.parse(recentChatTurnString) ?? [],
				longTermHistory: [],
				relevantLore: [],
				relevantHistory: [],
				factualRecapSummary: '',
				relationshipRecapSummary: '',
			};
		} else {
			throw error; // Re-throw critical errors
		}
	}

	// 2. Generate the new persona response.
	const personaResponse = await personaEngine.generateResponse(
		recalledMemories,
		characterInfo,
		profileInfo,
		userInput,
		aiModelInfo,
		options
	);

	// 3. Create the new bot response message.
	const request = buildChatMessage(
		'user',
		tempTurn.sequence,
		profileInfo.showName,
		userInput,
		tempTurn.sessionId
	);
	const response = buildChatMessage(
		'assistant',
		tempTurn.sequence,
		characterInfo.showName,
		personaResponse.response,
		tempTurn.sessionId,
		personaResponse.emotion
	);
	const newChatTurnSet: ChatMessageSet = { request, response, setNo: tempTurn.chatTurnSets.length };

	// 4. Append the new response to the options array and update the timestamp.
	tempTurn.chatTurnSets.push(newChatTurnSet);
	tempTurn.updatedAt = new Date().toISOString();

	return tempTurn;
}
