// src/server/services/orchestrationService.ts (Updated)

import {
	ChatGenerationStage,
	MemoryResponse,
	ReceiveBotResponseIntent,
} from '@rita-berenice/shared/api';
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
import {
	createOperationLogger,
	flowLogger,
	OperationLogger,
	serializeError,
} from '../util/jsonlLogger.js';
import { handleServiceError } from '../util/serviceHelpers.js';
import { memoryEngine } from './memoryEngine.js';
import { personaEngine } from './personaEngine.js';

export interface ReceiveBotResponseOptions {
	intent?: ReceiveBotResponseIntent;
	adultContentEnabled?: boolean;
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
	const { sequence, sessionId, inputJsonString } = tempChatTurnCdo;
	const requestId = `chat:${sessionId}:${sequence}:${Date.now()}`;
	const logger = createOperationLogger('orchestrationService', 'receiveBotResponse', {
		requestId,
		sessionId,
		turn: sequence,
		userId: tempChatTurnCdo.userId,
		model: aiModelInfo.model,
	});

	const controller = new AbortController();
	const abortFromCaller = () => controller.abort(options.signal?.reason);
	if (options.signal?.aborted) {
		abortFromCaller();
	} else {
		options.signal?.addEventListener('abort', abortFromCaller, { once: true });
	}
	const timeoutId = setTimeout(() => {
		logger.warn('timeout', { timeoutSeconds: ABORT_TIMEOUT });
		controller.abort();
	}, ABORT_TIMEOUT * 1000);

	logger.info('start');

	try {
		options.onStatus?.('preparing');
		// 1. 턴 가져오기 또는 생성
		let tempTurn = await _getOrCreateTempTurn(sessionId, sequence, tempChatTurnCdo.userId);
		// --- 2. LOG CHECKPOINT 1 ---
		logger.checkpoint('tempTurn.ready', { existingOptionCount: tempTurn.setCount });
		const userConverSation = parseEntriesToConversation(JSON.parse(inputJsonString));
		// Checked before generating, so a rejected request costs nothing.
		assertRerollRequestMatches(tempTurn, userConverSation, options.intent ?? 'new', logger);

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
				adultContentEnabled: options.adultContentEnabled,
				onStatus: options.onStatus,
				onDelta: options.onDelta,
				logger,
			}
		);
		logger.checkpoint('llm.responseFinished', { optionCount: tempTurn.setCount });
		// 3. 최종 상태 저장
		options.onStatus?.('saving');
		await tempStore.saveTempChatTurn(tempTurn);
		logger.checkpoint('tempTurn.saved', { optionCount: tempTurn.setCount });

		logger.complete({ optionCount: tempTurn.setCount });
		return tempTurn;
	} catch (error: any) {
		logger.error('failed', { error: error instanceof Error ? error.message : String(error) });
		handleServiceError(
			error,
			`[Orchestrator] Failed to process chat request for session ${sessionId}, turn ${sequence}.`,
			'An unexpected error occurred while processing the request.'
		);
	} finally {
		clearTimeout(timeoutId);
		options.signal?.removeEventListener('abort', abortFromCaller);
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
	const logger = createOperationLogger('orchestrationService', 'finalizeChatTurn', {
		sessionId,
		turn: sequence,
		userId: chatTurnCdo.userId,
	});
	logger.info('start');

	try {
		const enrichedChatTurn = await enrichChatTurn(createBasicChatTurn(chatTurnCdo));
		await chatStore.storeChatTurn(enrichedChatTurn);

		logger.complete();
		return enrichedChatTurn;
	} catch (error: any) {
		logger.error('failed', serializeError(error));
		handleServiceError(
			error,
			`[Orchestrator] Failed to finalize chat turn for session ${sessionId}, sequence ${sequence}.`,
			'An unexpected error occurred while finalizing the chat turn.'
		);
	}
};

/**
 * Takes the already-built basic turn rather than the CDO so the caller can store that exact turn
 * first and enrich the same object. Building it twice would stamp two different `createdAt`
 * values for one turn.
 */
export const enrichChatTurn = async (basicChatTurn: ChatTurn): Promise<ChatTurn> =>
	memoryEngine.enrichChatTurnViaLlm(basicChatTurn);

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
		flowLogger.info('orchestrationService', 'tempTurn.found', { sessionId, turn: sequence });
		// Assuming the response object contains the turn, e.g., { tempChatTurn: ... }
		return response.tempChatTurn;
	} catch (error: any) {
		// 2. Check if the error is the specific "Not Found" error.
		if (error instanceof ApiError && error.status === 404) {
			// 3. If it is a 404, the turn doesn't exist. Create a new one.
			flowLogger.info('orchestrationService', 'tempTurn.create', { sessionId, turn: sequence });
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
			flowLogger.error('orchestrationService', 'tempTurn.lookup.failed', {
				sessionId,
				turn: sequence,
				...serializeError(error),
			});
			throw error;
		}
	}
};
// In src/server/services/orchestrationService.ts

/**
 * [HELPER] Keeps a reroll from turning into a second, unrelated question on the same turn.
 *
 * A temp turn models one request with several candidate responses; `fixedSetNo` later picks one
 * response for that one request. Two *different* requests sharing a turn is a state the model
 * cannot express - finalizing it keeps whichever set is picked and silently drops the other. That
 * is what happened in the public demo: turn 6 failed to finalize, the client's next-sequence
 * counter never advanced, and the user's next question landed on sequence 6 as setNo 1 beside an
 * unrelated setNo 0.
 *
 * The root cause was that `receiveBotResponse` could not tell the two intents apart - a reroll and
 * a new message were the same call with the same shape. `intent` now carries that, and a reroll
 * claiming to reuse a request it does not match is refused before any generation is paid for.
 *
 * A mismatch under intent 'new' is only logged, not refused: the send path computes its sequence
 * from finalized turns alone, so a turn still awaiting finalization can legitimately produce this
 * shape, and rejecting it would break ordinary chatting. Storing the basic turn before enrichment
 * (see finalizationJobService) is what keeps the sequence moving; this log is here to show whether
 * any case survives that fix.
 *
 * Exported for tests; nothing outside this module calls it.
 */
export const assertRerollRequestMatches = (
	tempTurn: TempChatTurn,
	userConversation: string,
	intent: ReceiveBotResponseIntent,
	logger?: OperationLogger
): void => {
	const existingRequest = tempTurn.chatTurnSets[0]?.request;
	if (!existingRequest) return;

	const existingConversation = parseEntriesToConversation(existingRequest.entries);
	if (existingConversation.trim() === userConversation.trim()) return;

	if (intent === 'reroll') {
		throw new ApiError(
			409,
			`[Orchestrator] Reroll for turn ${tempTurn.sequence} of session ${tempTurn.sessionId} does not match the request already stored on that turn.`,
			'This message changed since it was sent. Reload the conversation and try again.'
		);
	}

	logger?.warn('tempTurn.requestMismatch', {
		existingSetCount: tempTurn.setCount,
		fixedSetNo: tempTurn.fixedSetNo,
	});
};

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
		adultContentEnabled?: boolean;
		onStatus?: (stage: ChatGenerationStage) => void;
		onDelta?: (delta: string) => void;
		logger?: OperationLogger;
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
		options.logger?.checkpoint('memoryRecall.start', { recentTurnCount: recentChatTurn.length });
		try {
			// Overwrite the default memories with the actual recalled data.
			recalledMemories = await memoryEngine.recallRelevantMemories(
				tempTurn.sessionId,
				userConversation,
				tempTurn.userId,
				recentChatTurn,
				langCode,
				aiModelInfo.model
			);
			options.logger?.checkpoint('memoryRecall.complete', {
				shortTermCount: recalledMemories.shortTermHistory.length,
				longTermCount: recalledMemories.longTermHistory.length,
				loreCount: recalledMemories.relevantLore.length,
				historyCount: recalledMemories.relevantHistory.length,
				hasFactualRecap: Boolean(recalledMemories.factualRecapSummary),
				hasRelationshipRecap: Boolean(recalledMemories.relationshipRecapSummary),
			});
		} catch (error: any) {
			// If recall fails with a 404, we log it and proceed.
			// The `recalledMemories` object will correctly keep its default empty state.
			if (error instanceof ApiError && error.status === 404) {
				options.logger?.warn('memoryRecall.empty', { status: 404 });
			} else {
				// For any other unexpected error, we re-throw to be handled by the caller.
				throw error;
			}
		}
	} else {
		// If there is no history, log it and proceed with the default empty context.
		options.logger?.checkpoint('memoryRecall.skipped', { reason: 'no_recent_chat_history' });
	}

	// 2. Generate the new persona response.
	options.onStatus?.('generating');
	options.logger?.checkpoint('personaGeneration.start');
	const personaResponse = await personaEngine.generateResponse(
		recalledMemories,
		characterInfo,
		profileInfo,
		userConversation,
		aiModelInfo,
		{
			signal: options.signal,
			adultContentEnabled: options.adultContentEnabled,
			onDelta: options.onDelta,
		}
	);
	options.logger?.checkpoint('personaGeneration.complete', { emotion: personaResponse.emotion });

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
