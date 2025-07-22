// src/server/services/personaEngine.ts

import { ChatCompletionMessageParam } from 'openai/resources/index.mjs';

import {
	buildJsonCorrectionPrompt,
	buildLongTermMemoryPrompt,
	buildPersonaSystemPrompt,
	buildStaticSystemPrompt,
} from '../util/templateUtils.js';
import { handleServiceError, LlmResponseParseError } from '../util/serviceHelpers.js';
import { parseLlmJsonResponse } from '../util/llmUtils.js';
import { MemoryResponse, PersonaResponse } from '#shared/api/ModuleResponse.js';
import { CharacterInfo } from '#shared/domain/character/CharacterInterfaces.js';
import { ChatMessage } from '#shared/domain/chat/ChatInterfaces.js';
import { llmService } from './llmService.js';
import {
	AiModelInfo,
	DEFAULT_MODEL_GOOGLEAI,
	DefaultAiRole,
} from '#shared/domain/aimodel/AiInfoTypes.js';
import { parseEntriesToText } from '#shared/util/chatParseUtils.js';
import { ProfileInfo } from '#shared/domain/profile/ProfileInterfaces.js';

const buildChatCompletion = (role: DefaultAiRole, content: string, name?: string) => {
	return { role, content, name };
};
export const personaEngine = {
	/**
	 * Generates a character's conversational response using a rich, recalled memory context.
	 * This version is refactored to ensure all exceptions are thrown and propagated.
	 *
	 * @returns A promise that resolves to the character's response and emotion.
	 * @throws {Error} Throws any error encountered during LLM invocation or parsing,
	 *                 allowing the caller to handle the exception.
	 */
	async generateResponse(
		recalledMemories: MemoryResponse,
		characterInfo: CharacterInfo,
		profileInfo: ProfileInfo,
		userInput: string,
		aiModelInfo: AiModelInfo,
		options?: { signal?: AbortSignal }
	): Promise<PersonaResponse> {
		console.log(
			`[personaEngine] Generating response for user ${profileInfo.name} in lang: ${recalledMemories.langCode}...`
		);

		try {
			// --- 1. MESSAGES 배열 구성 ---
			// LLM에 전달할 최종 메시지 배열을 단계적으로 구성합니다.

			const testSystemPrompt = buildPersonaSystemPrompt(characterInfo, profileInfo, recalledMemories);
			// 1a. 정적 시스템 프롬프트 (핵심 규칙 및 페르소나)
			const staticSystemPrompt = buildStaticSystemPrompt(
				characterInfo,
				profileInfo,
				recalledMemories.langCode
			);

			// 1b. 동적 컨텍스트 프롬프트 (RAG 검색 결과: Lore, History, Recap 등)
			const longTermMemoryContent = buildLongTermMemoryPrompt(
				recalledMemories,
				recalledMemories.langCode
			);

			// 1c. 단기 대화 기록 (가장 최근의 N개 턴)
			const shortTermMessages = recalledMemories.shortTermHistory
				.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
				.flatMap((turn) => {
					const turnMessages = [];
					if (turn.request) {
						turnMessages.push(
							buildChatCompletion('user', parseEntriesToText(turn.request.entries), turn.request.showName)
						);
					}
					if (turn.response) {
						// 로직 오류 수정: assistant의 응답은 turn.response에서 가져옵니다.
						turnMessages.push(
							buildChatCompletion(
								'assistant',
								parseEntriesToText(turn.response.entries),
								turn.response.showName
							)
						);
					}
					return turnMessages;
				});

			// --- 2. 최종 MESSAGES 배열 조립 ---
			// 모든 구성 요소를 명확한 순서에 따라 하나의 배열로 결합합니다.
			// const messages: ChatCompletionMessageParam[] = [
			// 	// 첫 번째: 핵심 규칙
			// 	buildChatCompletion('system', staticSystemPrompt),

			// 	// 두 번째: 배경지식 (내용이 있을 경우에만 추가)
			// 	...(longTermMemoryContent ? [buildChatCompletion('system', longTermMemoryContent)] : []),

			// 	// 세 번째: 최근 대화 기록
			// 	...shortTermMessages,

			// 	// 네 번째 (마지막): 현재 사용자 입력
			// 	buildChatCompletion('user', userInput, profileInfo.showName),
			// ];

			const messages: ChatCompletionMessageParam[] = [
				// 첫 번째: 핵심 규칙
				buildChatCompletion('system', testSystemPrompt),
				// 네 번째 (마지막): 현재 사용자 입력
				buildChatCompletion('user', userInput, profileInfo.showName),
			];

			// (디버깅용) 최종적으로 전송될 메시지 배열을 확인하고 싶을 때 유용합니다.
			console.log('[DEBUG] Final messages payload:', JSON.stringify(messages, null, 2));

			// --- 3. LLM 서비스 호출 ---
			// 잘 정돈된 단일 messages 배열을 서비스에 전달합니다.
			const rawLlmResponse = await llmService.invokeLlm(
				messages,
				aiModelInfo,
				profileInfo.userId,
				options
			);

			return parseLlmJsonResponse<PersonaResponse>(
				rawLlmResponse,
				'personaEngine.generateResponse (Attempt 1)'
			);
		} catch (error: any) {
			// --- 4. HANDLE ERRORS ---
			// Check if it's a parsing error that we can try to self-correct.
			// if (error instanceof LlmResponseParseError) {
			// 	console.warn(
			// 		`[personaEngine] Initial LLM response failed parsing. Reason: ${error.reason}. Attempting self-correction...`
			// 	);

			// 	// --- LLM Call #2: Corrective Attempt ---
			// 	try {
			// 		const requiredSchema = '{"response": "string", "emotion": "string"}';
			// 		const correctionPrompt = buildJsonCorrectionPrompt(
			// 			error.details.rawResponse,
			// 			`The JSON was malformed. Reason: ${error.reason}.`,
			// 			requiredSchema
			// 		)

			// 		// Attempt to parse the corrected response. If this fails, the outer catch will handle it.
			// 		return parseLlmJsonResponse<PersonaResponse>(
			// 			correctedLlmResponse,
			// 			'personaEngine.generateResponse (Attempt 2)'
			// 		);
			// 	} catch (correctionError: any) {
			// 		console.error('[personaEngine] Self-correction attempt also failed.', correctionError);
			// 		// Throw the original error because it's more indicative of the root cause.
			// 		// This ensures the failure propagates up to receiveBotResponse.
			// 		throw error;
			// 	}
			// }

			// For all other errors (including direct LLM invocation errors or failed corrections),
			// log the context and re-throw the error to be handled by the caller.
			console.error('[personaEngine] Failed to generate response for session.', error);
			throw error;
		}
	},
};
