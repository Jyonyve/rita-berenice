// src/server/services/personaEngine.ts

import {
	CharacterInfo,
	ProfileInfo,
	ChatMessage,
	PersonaResponse,
	MemoryResponse,
	DEFAULT_MODEL_GOOGLEAI, // Assuming this is your default chat model
	parseEntriesToText,
	AiModelInfo,
} from '#shared/index.js';
import { ChatCompletionMessageParam } from 'openai/resources/index.mjs';
import { llmService } from './index.js';
import { buildPersonaSystemPrompt, buildJsonCorrectionPrompt } from '../util/templateUtils.js';
import { handleServiceError, LlmResponseParseError } from '../util/serviceHelpers.js';
import { parseLlmJsonResponse } from '../util/llmUtils.js';

export const personaEngine = {
	/**
	 * Generates a character's conversational response using a rich, recalled memory context.
	 * This is the definitive, refactored version.
	 *
	 * @param recalledMemories The payload of context recalled by memoryEngine.
	 * @param characterInfo The full metadata for the character persona.
	 * @param profileInfo The full user profile info object.
	 * @param currentUserRequest The user's most recent message.
	 * @param lang The detected language ('kor' or 'eng').
	 * @param options An object containing the AbortSignal for timeout control.
	 * @returns A promise that resolves to the character's response and emotion.
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
			// --- 1. BUILD THE COMPREHENSIVE SYSTEM PROMPT ---
			// All the complex logic is now neatly encapsulated in this single function call.
			const systemPromptContent = buildPersonaSystemPrompt(
				characterInfo,
				profileInfo,
				recalledMemories
			);

			const messages: ChatCompletionMessageParam[] = [
				{ role: 'system', content: systemPromptContent },
			];

			// --- 2. CONSTRUCT THE SHORT-TERM CONVERSATIONAL HISTORY ---
			// Use the most recent turns for immediate conversational back-and-forth.
			// The `shortTermHistory` should be ordered from oldest to newest.
			for (const turn of recalledMemories.shortTermHistory) {
				const reqContent = parseEntriesToText(turn.request.entries);
				const resContent = parseEntriesToText(turn.response.entries);
				// Add a 'name' field to help the model distinguish speakers.
				if (reqContent) messages.push({ role: 'user', content: reqContent, name: profileInfo.name });
				if (resContent)
					messages.push({ role: 'assistant', content: resContent, name: characterInfo.name });
			}

			// Finally, add the current user's request to the end of the history.
			messages.push({
				role: 'user',
				content: parseEntriesToText(currentUserRequest.entries),
				name: profileInfo.name,
			});

			// --- 3. INVOKE LLM AND PARSE RESPONSE (Initial Attempt) ---
			const rawLlmResponse = await llmService.invokeLlmFromMessages(
				messages,
				aiModelInfo, // Or a user-selected model
				options
			);

			// Our robust parser will either succeed or throw a specific error.
			return parseLlmJsonResponse<PersonaResponse>(
				rawLlmResponse,
				'personaEngine.generateResponse (Attempt 1)'
			);
		} catch (error: any) {
			// --- 4. HANDLE ERRORS, INCLUDING SELF-CORRECTION FOR PARSING FAILURES ---
			if (error instanceof LlmResponseParseError) {
				console.warn(
					`[personaEngine] Initial LLM response failed parsing. Reason: ${error.reason}. Attempting self-correction...`
				);

				// --- LLM Call #2: Corrective Attempt ---
				try {
					const requiredSchema = '{"response": "string", "emotion": "string"}';
					const correctionPrompt = buildJsonCorrectionPrompt(
						error.details.rawResponse, // The failed output from the error object
						`The JSON was malformed. Reason: ${error.reason}.`, // Provide the reason
						requiredSchema
					);

					const correctedLlmResponse = await llmService.invokeLlm(
						'user',
						correctionPrompt,
						DEFAULT_MODEL_GOOGLEAI,
						options
					);

					// Attempt to parse the corrected response. If this fails, the outer catch will handle it.
					return parseLlmJsonResponse<PersonaResponse>(
						correctedLlmResponse,
						'personaEngine.generateResponse (Attempt 2)'
					);
				} catch (correctionError) {
					console.error('[personaEngine] Self-correction attempt also failed.', correctionError);
					// We throw the original error because it's more indicative of the root cause.
					handleServiceError(
						error,
						`[personaEngine] Failed to generate response after self-correction attempt.`
					);
				}
			}

			// If it wasn't our specific parsing error, handle it normally.
			handleServiceError(error, `[personaEngine] Failed to generate response for session.`);
		}
	},
};
