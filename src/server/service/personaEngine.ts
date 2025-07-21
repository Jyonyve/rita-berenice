// src/server/services/personaEngine.ts

import { ChatCompletionMessageParam } from 'openai/resources/index.mjs';

import { buildPersonaSystemPrompt, buildJsonCorrectionPrompt } from '../util/templateUtils.js';
import { handleServiceError, LlmResponseParseError } from '../util/serviceHelpers.js';
import { parseLlmJsonResponse } from '../util/llmUtils.js';
import { MemoryResponse, PersonaResponse } from '#shared/api/ModuleResponse.js';
import { CharacterInfo } from '#shared/domain/character/CharacterInterfaces.js';
import { ChatMessage } from '#shared/domain/chat/ChatInterfaces.js';
import { llmService } from './llmService.js';
import { AiModelInfo, DEFAULT_MODEL_GOOGLEAI } from '#shared/domain/aimodel/AiInfoTypes.js';
import { parseEntriesToText } from '#shared/util/chatParseUtils.js';
import { ProfileInfo } from '#shared/domain/profile/ProfileInterfaces.js';

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
		currentUserRequest: ChatMessage,
		aiModelInfo: AiModelInfo,
		options?: { signal?: AbortSignal }
	): Promise<PersonaResponse> {
		console.log(
			`[personaEngine] Generating response for user ${profileInfo.name} in lang: ${recalledMemories.langCode}...`
		);

		try {
			// --- 1. BUILD SYSTEM PROMPT ---
			const systemPromptContent = buildPersonaSystemPrompt(
				characterInfo,
				profileInfo,
				recalledMemories
			);

			// --- 2. CONSTRUCT MESSAGE HISTORY ---
			const messages: ChatCompletionMessageParam[] = [
				{ role: 'system', content: systemPromptContent },
			];

			for (const turn of recalledMemories.shortTermHistory) {
				const reqContent = parseEntriesToText(turn.request.entries);
				const resContent = parseEntriesToText(turn.response.entries);
				if (reqContent) messages.push({ role: 'user', content: reqContent, name: profileInfo.name });
				if (resContent)
					messages.push({ role: 'assistant', content: resContent, name: characterInfo.name });
			}

			messages.push({
				role: 'user',
				content: parseEntriesToText(currentUserRequest.entries),
				name: profileInfo.name,
			});

			// --- 3. INVOKE LLM AND PARSE (Initial Attempt) ---
			const rawLlmResponse = await llmService.invokeLlmFromMessages(
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
			if (error instanceof LlmResponseParseError) {
				console.warn(
					`[personaEngine] Initial LLM response failed parsing. Reason: ${error.reason}. Attempting self-correction...`
				);

				// --- LLM Call #2: Corrective Attempt ---
				try {
					const requiredSchema = '{"response": "string", "emotion": "string"}';
					const correctionPrompt = buildJsonCorrectionPrompt(
						error.details.rawResponse,
						`The JSON was malformed. Reason: ${error.reason}.`,
						requiredSchema
					);

					const correctedLlmResponse = await llmService.invokeLlm(
						'user',
						correctionPrompt,
						aiModelInfo,
						profileInfo.userId,
						options
					);

					// Attempt to parse the corrected response. If this fails, the outer catch will handle it.
					return parseLlmJsonResponse<PersonaResponse>(
						correctedLlmResponse,
						'personaEngine.generateResponse (Attempt 2)'
					);
				} catch (correctionError: any) {
					console.error('[personaEngine] Self-correction attempt also failed.', correctionError);
					// Throw the original error because it's more indicative of the root cause.
					// This ensures the failure propagates up to receiveBotResponse.
					throw error;
				}
			}

			// For all other errors (including direct LLM invocation errors or failed corrections),
			// log the context and re-throw the error to be handled by the caller.
			console.error('[personaEngine] Failed to generate response for session.', error);
			throw error;
		}
	},
};
