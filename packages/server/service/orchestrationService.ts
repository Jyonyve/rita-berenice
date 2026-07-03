// src/server/services/orchestrationService.ts (Updated)

import { ChatGenerationStage, MemoryResponse } from '@rita-berenice/shared/api';
import { ABORT_TIMEOUT, METADATA_TYPES } from '@rita-berenice/shared/config';
import {
	TempChatTurnCdo,
	CharacterInfo,
	ProfileInfo,
	AiModelInfo,
	TempChatTurn,
	ChatTurnCdo,
	ChatTurn,
	ApiError,
	ChatMessageSet,
} from '@rita-berenice/shared/domain';
import { createBasicChatTurn, buildTempChatTurnId } from '@rita-berenice/shared/util';
import { chatStore } from '../store/chatStore.js';
import { tempStore } from '../store/tempStore.js';
import { parseEntriesToConversation, buildChatMessage } from '../util/chatParseUtils.js';
import { detectLanguage } from '../util/languageUtils.js';
import { sanitizeLlmResponse } from '../util/llmUtils.js';
import { handleServiceError } from '../util/serviceHelpers.js';
import { memoryEngine } from './memoryEngine.js';
import { personaEngine } from './personaEngine.js';

const timerLabel = (sequence: number) => `RESPONSE_GENERATION: Turn ${sequence}`;

export interface ReceiveBotResponseOptions {
	isScene?: boolean;
	signal?: AbortSignal;
	onStatus?: (stage: ChatGenerationStage) => void;
	onDelta?: (delta: string) => void;
}

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
	recentChatTurnString: string,
	options: ReceiveBotResponseOptions = {}
): Promise<TempChatTurn> => {
	// --- 1. START TIMER ---
	console.time(timerLabel(tempChatTurnCdo.sequence));

	const { sequence, sessionId, inputJsonString } = tempChatTurnCdo;

	const controller = new AbortController();
	const abortFromCaller = () => controller.abort(options.signal?.reason);
	if (options.signal?.aborted) {
		abortFromCaller();
	} else {
		options.signal?.addEventListener('abort', abortFromCaller, { once: true });
	}
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
		options.onStatus?.('preparing');
		// 1. 턴 가져오기 또는 생성
		let tempTurn = await _getOrCreateTempTurn(sessionId, sequence, tempChatTurnCdo.userId);
		// --- 2. LOG CHECKPOINT 1 ---
		console.timeLog(timerLabel(tempChatTurnCdo.sequence), 'Temp turn ready.');
		const userConverSation = parseEntriesToConversation(JSON.parse(inputJsonString));

		// 2. 새로운 응답 생성 및 추가 (책임 위임)
		tempTurn = await _generateAndAppendResponse(
			tempTurn,
			userConverSation,
			characterInfo,
			profileInfo,
			aiModelInfo,
			recentChatTurnString,
			{
				signal: controller.signal,
				isScene: options.isScene,
				onStatus: options.onStatus,
				onDelta: options.onDelta,
			}
		);
		console.timeLog(timerLabel(tempTurn.sequence), 'LLM RESPONSE FINISHED.');
		// 3. 최종 상태 저장
		options.onStatus?.('saving');
		await tempStore.saveTempChatTurn(tempTurn);
		console.timeLog(timerLabel(tempTurn.sequence), 'TEMP TURN SAVED.');

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
		options.signal?.removeEventListener('abort', abortFromCaller);
		console.timeEnd(timerLabel(tempChatTurnCdo.sequence));
		console.log(`[Orchestrator] Execution of receiveBotResponse for session ${sessionId} completed.`);
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
		const enrichedChatTurn = await enrichChatTurn(chatTurnCdo);
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

export const enrichChatTurn = async (chatTurnCdo: ChatTurnCdo): Promise<ChatTurn> => {
	const basicChatTurn: ChatTurn = createBasicChatTurn(chatTurnCdo);
	return memoryEngine.enrichChatTurnViaLlm(basicChatTurn);
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
 * This is the core business logic for a single response generation.F
 * @private
 */
async function _generateAndAppendResponse(
	tempTurn: TempChatTurn,
	userConversation: string,
	characterInfo: CharacterInfo,
	profileInfo: ProfileInfo,
	aiModelInfo: AiModelInfo,
	recentChatTurnString: string,
	options: {
		signal?: AbortSignal;
		isScene?: boolean;
		onStatus?: (stage: ChatGenerationStage) => void;
		onDelta?: (delta: string) => void;
	}
): Promise<TempChatTurn> {
	// 1. Recall relevant memories for context.
	const langCode = detectLanguage(userConversation);
	const recentChatTurn: ChatTurn[] = JSON.parse(recentChatTurnString);

	// 1. Initialize with a default, empty memory context.
	let recalledMemories: MemoryResponse = {
		langCode,
		shortTermHistory: recentChatTurn ?? [],
		longTermHistory: [],
		relevantLore: [],
		relevantHistory: [],
		factualRecapSummary: '',
		relationshipRecapSummary: '',
	};

	if (recentChatTurn && recentChatTurn.length > 0) {
		options.onStatus?.('retrieving');
		console.timeLog(timerLabel(tempTurn.sequence), 'Attempting memory recall...');
		try {
			// Overwrite the default memories with the actual recalled data.
			recalledMemories = await memoryEngine.recallRelevantMemories(
				tempTurn.sessionId,
				userConversation,
				tempTurn.userId,
				recentChatTurn,
				langCode
			);
			// --- 2. LOG CHECKPOINT 2 ---
			console.timeLog(timerLabel(tempTurn.sequence), 'Memory recall finish. completed.');
		} catch (error: any) {
			// If recall fails with a 404, we log it and proceed.
			// The `recalledMemories` object will correctly keep its default empty state.
			if (error instanceof ApiError && error.status === 404) {
				console.warn(`[Orchestrator] No memories found for session. Proceeding with default context.`);
				console.timeLog(timerLabel(tempTurn.sequence), 'Memory recall finish. Empty memory.');
			} else {
				// For any other unexpected error, we re-throw to be handled by the caller.
				throw error;
			}
		}
	} else {
		// If there is no history, log it and proceed with the default empty context.
		console.log(`[Orchestrator] No recent chat history. Skipping memory recall.`);
	}

	// 2. Generate the new persona response.
	options.onStatus?.('generating');
	const personaResponse = await personaEngine.generateResponse(
		recalledMemories,
		characterInfo,
		profileInfo,
		userConversation,
		aiModelInfo,
		{ signal: options.signal, isScene: options.isScene, onDelta: options.onDelta }
	);
	console.timeLog(timerLabel(tempTurn.sequence), 'llm generate response finishing.');

	const botChatEntries = sanitizeLlmResponse(personaResponse.response);
	// 3. Create the new bot response message.
	const request = buildChatMessage(
		'user',
		tempTurn.sequence,
		profileInfo.showName,
		userConversation,
		tempTurn.sessionId
	);
	const response = buildChatMessage(
		'assistant',
		tempTurn.sequence,
		characterInfo.showName,
		parseEntriesToConversation(botChatEntries),
		tempTurn.sessionId,
		personaResponse.emotion,
		aiModelInfo.model
	);
	const newChatTurnSet: ChatMessageSet = { request, response, setNo: tempTurn.chatTurnSets.length };

	// 4. Append the new response to the options array and update the timestamp.
	tempTurn.chatTurnSets.push(newChatTurnSet);
	tempTurn.setCount = tempTurn.chatTurnSets.length;
	tempTurn.updatedAt = new Date().toISOString();

	return tempTurn;
}
