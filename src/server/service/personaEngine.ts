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
import { correctAiModelInfo } from '#shared/config/supportAiModelInfo.js';
import { createPersonaResponseSchema } from '../util/schemaUtils.js';

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
		const { langCode } = recalledMemories;
		const { showName: charName } = characterInfo;
		const { showName: userName } = profileInfo;

		// --- 1. MESSAGES 배열 구성 ---
		// LLM에 전달할 최종 메시지 배열을 단계적으로 구성합니다.

		const testSystemPrompt = buildPersonaSystemPrompt(characterInfo, profileInfo, recalledMemories);
		// 1a. 정적 시스템 프롬프트 (핵심 규칙 및 페르소나)
		const staticSystemPrompt = buildStaticSystemPrompt(characterInfo, profileInfo, langCode);

		// 1b. 동적 컨텍스트 프롬프트 (RAG 검색 결과: Lore, History, Recap 등)
		const longTermMemoryContent = buildLongTermMemoryPrompt(recalledMemories, langCode);

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

		// 1. Build the simplified system prompt (without JSON instructions)
		const messages: ChatCompletionMessageParam[] = [
			// 첫 번째: 핵심 규칙
			buildChatCompletion('system', testSystemPrompt),
			// 네 번째 (마지막): 현재 사용자 입력
			buildChatCompletion('user', userInput, profileInfo.showName),
		];

		const personaSchema = createPersonaResponseSchema(charName, userName, langCode);
		// (디버깅용) 최종적으로 전송될 메시지 배열을 확인하고 싶을 때 유용합니다.
		console.log('[DEBUG] Final messages payload:', JSON.stringify(messages, null, 2));

		try {
			// --- 3. LLM 서비스 호출 ---
			// 잘 정돈된 단일 messages 배열을 서비스에 전달합니다.
			const rawLlmResponse = await llmService.invokeLlm(
				messages,
				aiModelInfo,
				profileInfo.userId,
				options,
				personaSchema // Provide the schema here
			);

			return parseLlmJsonResponse<PersonaResponse>(
				rawLlmResponse,
				'personaEngine.generateResponse (Attempt 1)'
			);
		} catch (error: any) {
			// --- 2. Error Handling: Check for a fixable parsing error ---
			if (error?.name === 'LlmResponseParseError') {
				console.warn(
					`[personaEngine] Initial response failed parsing. Reason: ${error.reason}. Attempting self-correction.`,
					{
						// By logging the details in an object, you can expand it
						// in your console to view the full, untruncated rawResponse.
						details: error.details,
					}
				);

				// --- 3. Second Attempt: Corrective LLM Call ---
				try {
					// Define cheaper, faster models for the correction task

					// Select the appropriate correction model based on the original provider
					const correctionModelName = correctAiModelInfo[aiModelInfo.platform][aiModelInfo.provider][0];

					const correctionAiModelInfo: AiModelInfo = {
						...aiModelInfo, // Inherit platform, temp, etc.
						model: correctionModelName,
						maxTokens: 800, // Correction should be short
					};

					console.log(`[personaEngine] Invoking correction model: ${correctionModelName}`);

					const requiredSchema = '{"response": "string", "emotion": "string"}';
					const correctionPrompt = buildJsonCorrectionPrompt(
						error.details.rawResponse,
						`The JSON was malformed. Reason: ${error.reason}.`,
						requiredSchema
					);

					// The entire request is now a single user instruction, ensuring compatibility.
					const correctionMessages: ChatCompletionMessageParam[] = [
						buildChatCompletion(
							'user',
							`You are an expert at fixing malformed JSON. Please correct the following text to match the required schema.\n\n${correctionPrompt}`
						),
					];

					const correctedLlmResponse = await llmService.invokeLlm(
						correctionMessages,
						correctionAiModelInfo,
						profileInfo.userId,
						options
					);

					return parseLlmJsonResponse<PersonaResponse>(
						correctedLlmResponse,
						'personaEngine (Attempt 2)'
					);
				} catch (correctionError: any) {
					console.error('[personaEngine] Self-correction attempt also failed.', correctionError);
					throw error;
				}
			} else {
				// This `else` block makes it clear what happens for other errors.
				console.error('[personaEngine] A non-recoverable error occurred.', error);
				throw error;
			}
		}
	},
};
