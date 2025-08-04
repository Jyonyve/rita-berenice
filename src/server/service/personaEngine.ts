// src/server/services/personaEngine.ts

import { ChatCompletionMessageParam } from 'openai/resources/index.mjs';

import {
	buildJsonCorrectionPrompt,
	buildLongTermMemoryPrompt,
	buildStaticSystemPrompt,
} from '../util/templateUtils.js';

import { buildChatCompletion, parseLlmJsonResponse } from '../util/llmUtils.js';
import { MemoryResponse, PersonaResponse } from '#shared/api/ModuleResponse.js';
import { CharacterInfo } from '#shared/domain/character/CharacterInterfaces.js';
import { ChatTurn } from '#shared/domain/chat/ChatInterfaces.js';
import { llmService } from './llmService.js';
import { AiModelInfo } from '#shared/domain/aimodel/AiInfoTypes.js';
import { parseEntriesToText } from '#shared/util/chatParseUtils.js';
import { ProfileInfo } from '#shared/domain/profile/ProfileInterfaces.js';
import { correctAiModelInfo } from '#shared/config/supportAiModelInfo.js';
import { createPersonaResponseSchema } from '../util/schemaUtils.js';

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
		options?: { signal?: AbortSignal; isScene?: boolean }
	): Promise<PersonaResponse> {
		console.log(
			`[personaEngine] Generating response for user ${profileInfo.name} in lang: ${recalledMemories.langCode}...`
		);
		const { langCode, shortTermHistory } = recalledMemories;
		const { showName: charName } = characterInfo;
		const { showName: userName } = profileInfo;

		// --- 1. Assemble Prompt Components ---

		// 1a. Static System Prompt (Core Rules & Persona)
		const staticSystemPrompt = buildStaticSystemPrompt(
			characterInfo,
			profileInfo,
			langCode,
			options?.isScene
		);

		// 1b. Long-Term Memory Prompt (RAG Content)
		// CORRECTION: Pass all necessary arguments for complete formatting.
		const longTermMemoryContent = buildLongTermMemoryPrompt(recalledMemories, langCode);

		// 1c. Short-Term History Messages (Verbatim recent chat)
		// REFACTOR: Use the dedicated builder function for cleanliness.
		const shortTermMessages = buildShortTermHistoryMessages(shortTermHistory);

		// --- 2. Assemble Final Messages Array ---
		// This structure is optimal and correct.
		const messages: ChatCompletionMessageParam[] = [
			// First: Core rules and persona
			buildChatCompletion('system', staticSystemPrompt),

			// Second (optional): Background knowledge from RAG
			...(longTermMemoryContent ? [buildChatCompletion('system', longTermMemoryContent)] : []),

			// Third: Recent conversation verbatim
			...shortTermMessages,

			// Last: The current user input
			buildChatCompletion('user', userInput, profileInfo.showName),
		];

		const personaSchema = createPersonaResponseSchema(charName, userName, langCode);
		// console.log('[DEBUG] Final messages payload:', JSON.stringify(messages, null, 2));

		try {
			// --- 3. LLM Service Call ---
			const rawLlmResponse = await llmService.invokeLlm(
				messages,
				aiModelInfo,
				profileInfo.userId,
				options,
				personaSchema
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
					const correctionModelName = correctAiModelInfo[aiModelInfo.platform][aiModelInfo.provider][0];

					const correctionAiModelInfo: AiModelInfo = {
						...aiModelInfo, // Inherit platform, temp, etc.
						model: correctionModelName,
						maxTokens: 1000, // Correction should be short
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

const buildShortTermHistoryMessages = (
	shortTermHistory: ChatTurn[]
): ChatCompletionMessageParam[] => {
	if (!shortTermHistory || shortTermHistory.length === 0) {
		return [];
	}

	// The flatMap function iterates over each turn and builds the corresponding
	// user and assistant messages, creating a flat array perfect for the API.
	return shortTermHistory.flatMap((turn) => {
		const turnMessages: ChatCompletionMessageParam[] = [];

		// Add the user's message part of the turn, if it exists
		if (turn.request?.entries) {
			turnMessages.push(
				buildChatCompletion('user', parseEntriesToText(turn.request.entries), turn.request.showName)
			);
		}

		// Add the assistant's (character's) response part of the turn, if it exists
		if (turn.response?.entries) {
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
};
