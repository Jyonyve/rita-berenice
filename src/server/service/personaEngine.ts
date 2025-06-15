// src/server/services/personaEngine.ts

import {
	CharacterInfo,
	ProfileInfo,
	ChatMessage,
	parseEntriesToText,
	LoreInfo,
	HistoryInfo,
	MemoryResponse,
	PersonaResponse,
	DEFAULT_MODEL_GOOGLEAI,
} from '#shared/index.ts';
import { ChatCompletionMessageParam } from 'openai/resources/index.mjs';
import { llmService } from './index.ts';
import { buildJsonCorrectionPrompt, buildPersonaSystemPrompt } from '../util/templateUtils.ts'; // Correct import from the provided file
import { handleServiceError, LlmResponseParseError, parseLlmJsonResponse } from '../util/index.ts';

/**
 * Helper function to format various memory types into a single, coherent string
 * for the "Official Lore & Background" section of the system prompt.
 * @param lores Array of recalled LoreInfo.
 * @param histories Array of recalled HistoryInfo.
 * @returns A formatted string containing lore and history context.
 */
const _formatGroundTruthForPrompt = (lores: LoreInfo[], histories: HistoryInfo[]): string => {
	const loreSection =
		lores?.length > 0
			? `Core Lore:\n${lores.map((l) => `- ${l.title}: ${l.content.substring(0, 250)}...`).join('\n')}`
			: '';

	const historySection =
		histories?.length > 0
			? `Relevant Historical Events:\n${histories.map((h) => `- ${h.title} (Period: ${h.periodLabel}): ${h.content.substring(0, 250)}...`).join('\n')}`
			: '';

	return [loreSection, historySection].filter(Boolean).join('\n\n');
};

export const personaEngine = {
	/**
	 * Generates a character's conversational response using a rich, recalled memory context.
	 * @param recalledMemories The payload of context recalled by memoryEngine.
	 * @param characterInfo The full metadata for the character persona.
	 * @param userInfo The basic info for the user.
	 * @param currentUserRequest The user's most recent message.
	 * @param options An object containing the AbortSignal for timeout control.
	 * @returns A promise that resolves to the character's response and emotion.
	 */
	async generateResponse(
		recalledMemories: MemoryResponse,
		characterInfo: CharacterInfo,
		userInfo: ProfileInfo,
		currentUserRequest: ChatMessage,
		options?: { signal?: AbortSignal }
	): Promise<PersonaResponse> {
		console.log(`[personaEngine] Generating response for user ${userInfo.name}...`);

		try {
			// --- 1. FORMAT RECALLED MEMORIES FOR THE PROMPT ---
			// Combine semantically relevant lore and history into the 'ground truth' document.
			const groundTruthDocument = _formatGroundTruthForPrompt(
				recalledMemories.relevantLore,
				recalledMemories.relevantHistory
			);

			// Semantically relevant past chats provide extra context about recurring topics.
			const longTermHistorySnippets =
				recalledMemories.longTermHistory?.length > 0
					? `### Relevant Past Conversation Snippets\nThis is not a full transcript, but snippets of past conversations relevant to the current topic:\n${recalledMemories.longTermHistory.map((t) => `- Turn ${t.sequence}: The conversation was about "${t.summary || 'a past event'}".`).join('\n')}`
					: '';

			// --- 2. BUILD THE COMPREHENSIVE SYSTEM PROMPT ---
			// Use the powerful prompt builder from your template file.
			let systemPromptContent = buildPersonaSystemPrompt(
				characterInfo.instruction,
				recalledMemories.factualRecapSummary || '', // Factual ledger from recaps
				recalledMemories.relationshipRecapSummary || '', // Relationship summary from recaps
				groundTruthDocument, // Combined Lore and History
				characterInfo.name,
				userInfo.name
			);

			// Inject the long-term history snippets right before the **RULES** section for maximum impact.
			if (longTermHistorySnippets) {
				const rulesIndex = systemPromptContent.indexOf('**RULES FOR CONSISTENCY');
				if (rulesIndex !== -1) {
					systemPromptContent =
						systemPromptContent.slice(0, rulesIndex) +
						longTermHistorySnippets +
						'\n\n' +
						systemPromptContent.slice(rulesIndex);
				} else {
					systemPromptContent += '\n\n' + longTermHistorySnippets;
				}
			}

			const messages: ChatCompletionMessageParam[] = [
				{ role: 'system', content: systemPromptContent },
			];

			// --- 3. CONSTRUCT THE SHORT-TERM CONVERSATIONAL HISTORY ---
			// Use the most recent turns for immediate conversational back-and-forth.
			for (const turn of recalledMemories.shortTermHistory) {
				const reqContent = parseEntriesToText(turn.request.entries);
				const resContent = parseEntriesToText(turn.response.entries);
				// Add a 'name' field to help the model distinguish speakers.
				if (reqContent) messages.push({ role: 'user', content: reqContent, name: userInfo.name });
				if (resContent)
					messages.push({ role: 'assistant', content: resContent, name: characterInfo.name });
			}

			// Finally, add the current user's request.
			messages.push({
				role: 'user',
				content: parseEntriesToText(currentUserRequest.entries),
				name: userInfo.name,
			});

			// --- 4. INVOKE LLM WITH TIMEOUT AND PARSE RESPONSE ---
			const rawLlmResponse = await llmService.invokeLlmFromMessages(
				messages,
				DEFAULT_MODEL_GOOGLEAI,
				options
			);

			// --- 3. Use the new, type-safe utility ---
			return parseLlmJsonResponse<PersonaResponse>(
				rawLlmResponse,
				'personaEngine.generateResponse (Attempt 1)'
			);
		} catch (error) {
			// --- Check if it's a parsable error from our utility ---
			if (error instanceof LlmResponseParseError) {
				console.warn(
					`[personaEngine] Initial LLM response failed parsing. Reason: ${error.reason}. Attempting self-correction...`
				);

				// --- LLM Call #2: Corrective Attempt ---
				try {
					const requiredSchema = '{"response": "string", "emotion": "string"}';
					const correctionPrompt = buildJsonCorrectionPrompt(
						error.details.rawResponse, // The failed output from the error object
						error.message, // The error message from JSON.parse
						requiredSchema
					);

					// Use a simple, direct LLM call for the correction
					const correctedLlmResponse = await llmService.invokeLlm(
						'user',
						correctionPrompt,
						DEFAULT_MODEL_GOOGLEAI,
						options
					);

					// Attempt to parse the corrected response. If this fails, it will throw again and be caught by the outer catch block.
					return parseLlmJsonResponse<PersonaResponse>(
						correctedLlmResponse,
						'personaEngine.generateResponse (Attempt 2)'
					);
				} catch (correctionError) {
					// If the second attempt also fails, we give up and let the error propagate.
					console.error('[personaEngine] Self-correction attempt failed.', correctionError);
					// We throw the original error because it's more indicative of the root cause
					handleServiceError(
						error,
						`[personaEngine] Failed to generate response after self-correction attempt.`
					);
				}
			}

			// If it wasn't a LlmResponseParseError, handle it normally.
			handleServiceError(error, `[personaEngine] Failed to generate response for session.`);
		}
	},
};
