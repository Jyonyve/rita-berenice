// src/server/services/personaEngine.ts

import {
	CharacterMetadata,
	AiModelInfo,
	ChatMessage,
	DEFAULT_EMOTION,
	BasicBeingInfo,
	ChatTurn, // We now work with the enriched turn
	parseEntriesToText,
	CharacterInfo,
	ProfileInfo,
	DEFAULT_CHAT_MODEL_FREE, // Assuming you have a default chat model defined
} from '#shared/index.ts';
import { ChatCompletionMessageParam } from 'openai/resources/index.mjs';
import { llmService, recapService, loreService } from './index.ts';
import { buildPersonaSystemPrompt } from '../util/templateUtils.ts'; // Import the new, correct prompt builder [1]

export interface PersonaResponse {
	response: string;
	emotion: string;
}

// A helper to robustly parse the LLM's JSON response
const _parseLlmJsonResponse = (jsonString: string): PersonaResponse => {
	if (!jsonString) {
		return { response: '[LLM returned empty response]', emotion: DEFAULT_EMOTION };
	}
	try {
		const parsed = JSON.parse(jsonString);
		// Basic validation of the parsed object's structure
		if (typeof parsed.response === 'string' && typeof parsed.emotion === 'string') {
			return parsed;
		}
		// If structure is wrong, return the raw string as response
		return { response: jsonString, emotion: DEFAULT_EMOTION };
	} catch (err) {
		console.error(`[personaEngine] LLM returned invalid JSON, using raw response. Error:`, err);
		return { response: jsonString, emotion: DEFAULT_EMOTION };
	}
};

// Define the model for this specific task.
// Using DEFAULT_CHAT_MODEL ensures consistency.
const PERSONA_RESPONSE_MODEL: AiModelInfo = DEFAULT_CHAT_MODEL_FREE;

export const personaEngine = {
	/**
	 * Generates a character's conversational response based on persona, memory, and an enriched context.
	 * This is a stateless method that receives all necessary information.
	 * @param enrichedTurn The ChatTurn object, now containing enrichedMetadata from memoryEngine.
	 * @param characterInfo The full metadata for the character persona.
	 * @param userInfo The basic info for the user.
	 * @param history The recent chat history as an array of ChatMessage.
	 * @param options An object containing the AbortSignal for timeout control.
	 * @returns A promise that resolves to the character's response and emotion.
	 */
	async generateResponse(
		enrichedTurn: ChatTurn,
		characterInfo: CharacterInfo,
		userInfo: ProfileInfo,
		history: ChatMessage[],
		options?: { signal?: AbortSignal }
	): Promise<PersonaResponse> {
		console.log(`[personaEngine] Generating response for turn ${enrichedTurn.sequence}...`);
		const { sessionId } = enrichedTurn;
		const { characterId } = characterInfo;

		try {
			// --- 1. GATHER ALL CONTEXTUAL DATA IN PARALLEL ---
			// Your new strategy: fetch multiple, specific memory sources.
			const [factualRecap, relationshipRecap, lore] = await Promise.all([
				recapService.getFactualRecap(sessionId), // Gets what the character has stated as fact
				recapService.getRelationshipRecap(sessionId), // Gets how the character feels about the user
				loreService.getLore(characterId), // Gets the absolute "ground truth" for the character
			]);

			// --- 2. BUILD THE COMPREHENSIVE SYSTEM PROMPT ---
			// Use the new, powerful prompt builder from your template file.
			const systemPromptContent = buildPersonaSystemPrompt(
				characterInfo.instruction,
				factualRecap.content,
				relationshipRecap.content,
				lore.content,
				characterInfo.name,
				userInfo.name
			);

			const messages: ChatCompletionMessageParam[] = [
				{ role: 'system', content: systemPromptContent },
			];

			// --- 3. CONSTRUCT THE FULL MESSAGE HISTORY ---
			// Append the recent chat history to the prompt context.
			for (const msg of history) {
				const content = parseEntriesToText(msg.entries);
				if (content && (msg.role === 'user' || msg.role === 'assistant')) {
					messages.push({ role: msg.role, content });
				}
			}
			// Finally, add the current user's request.
			messages.push({ role: 'user', content: parseEntriesToText(enrichedTurn.request.entries) });

			// --- 4. INVOKE LLM WITH TIMEOUT AND PARSE RESPONSE ---
			// Pass the timeout signal down to the LLM service.
			const rawJsonResponse = await llmService.invokeLlmFromMessages(
				messages,
				PERSONA_RESPONSE_MODEL,
				options
			);

			return _parseLlmJsonResponse(rawJsonResponse);
		} catch (error) {
			console.error(`[personaEngine] Failed to generate response for session ${sessionId}:`, error);
			// Re-throw the error to be caught by the main orchestrator (handleChatRequest).
			// This will trigger the global failure/timeout handling.
			throw error;
		}
	},
};
