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
		tempTurn = await _generateAndAppendResponseSet(
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
 * [HELPER] 기존 TempChatTurn을 가져오거나, 존재하지 않을 경우 새로 생성합니다.
 * 이 함수는 턴 데이터의 상태를 관리하는 책임을 가집니다.
 * @private
 */

const _getOrCreateTempTurn = async (
	sessionId: string,
	sequence: number,
	userId: string
): Promise<TempChatTurn> => {
	// 1. tempStore에서 TempChatTurn을 가져옵니다.
	// getTempChatTurn은 에러를 던지는 대신, 결과가 없으면 tempChatTurn: null을 포함한 객체를 반환합니다.
	const response = await tempStore.getTempChatTurn(sessionId, sequence);

	// 2. 응답 객체에 유효한 tempChatTurn 데이터가 있는지 확인합니다.
	if (response && response.tempChatTurn) {
		// 기존 턴 데이터가 존재하면, 해당 데이터를 반환합니다.
		console.log(`[Orchestrator] Existing temp turn found for turn ${sequence}.`);
		return response.tempChatTurn;
	}

	// 3. 기존 턴 데이터가 없으면 (null이면), 새로운 턴을 생성하여 반환합니다.
	console.log(`[Orchestrator] No existing temp turn found. Creating new for turn ${sequence}.`);
	const now = new Date().toISOString();
	return {
		userId: userId,
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
};

/**
 * [HELPER] LLM을 호출하여 새로운 응답 세트를 생성하고, 이를 TempChatTurn에 추가합니다.
 * 이 함수는 실제 AI 응답을 생성하고 데이터를 가공하는 핵심 비즈니스 로직을 담당합니다.
 * @private
 */
const _generateAndAppendResponseSet = async (
	tempTurn: TempChatTurn,
	userInput: string,
	characterInfo: CharacterInfo,
	profileInfo: ProfileInfo,
	aiModelInfo: AiModelInfo,
	recentChatTurnString: string,
	options: { signal?: AbortSignal }
): Promise<TempChatTurn> => {
	// 1. 컨텍스트 회상
	const recalledMemories = await memoryEngine.recallRelevantMemories(
		tempTurn.sessionId,
		userInput,
		recentChatTurnString
	);

	// 2. 페르소나 응답 생성
	const personaResponse = await personaEngine.generateResponse(
		recalledMemories,
		characterInfo,
		profileInfo,
		userInput,
		aiModelInfo,
		options // AbortSignal 전달
	);

	// 3. 새로운 응답 세트(Set) 생성
	const userChatMessage = buildChatMessage(
		'user',
		tempTurn.sequence,
		profileInfo.showName,
		userInput,
		tempTurn.sessionId
	);
	const botChatMessage = buildChatMessage(
		'assistant',
		tempTurn.sequence,
		characterInfo.showName,
		personaResponse.response,
		tempTurn.sessionId,
		personaResponse.emotion
	);

	const newSet: ChatMessageSet = {
		request: userChatMessage,
		response: botChatMessage,
		setNo: tempTurn.chatTurnSets.length,
	};

	// 4. 기존 턴에 새로운 세트 추가 및 메타데이터 업데이트
	tempTurn.chatTurnSets.push(newSet);
	tempTurn.setCount = tempTurn.chatTurnSets.length;
	tempTurn.updatedAt = new Date().toISOString();

	// 수정된 TempChatTurn 객체를 반환 (아직 저장되지는 않은 상태)
	return tempTurn;
};
