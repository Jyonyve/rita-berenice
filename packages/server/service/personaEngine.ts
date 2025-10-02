// src/server/services/personaEngine.ts

import { ChatCompletionMessageParam } from 'openai/resources/index.mjs';

import {
	buildJsonCorrectionPrompt,
	buildLongTermMemoryPrompt,
	buildStaticSystemPrompt,
} from '../util/templateUtils.js';
import { buildChatCompletion } from '../util/llmUtils.js';
import { createPersonaResponseSchema } from '../util/schemaUtils.js';
import { logFlow } from '../util/jsonlLogger.js';
import { parseEntriesToConversation } from '../util/chatParseUtils.js';
import { MemoryResponse, PersonaResponse } from '@rita-berenice/shared/api';
import {
	CharacterInfo,
	ProfileInfo,
	AiModelInfo,
	DEFAULT_EXTRACTION_MODEL,
	ChatTurn,
} from '@rita-berenice/shared/domain';
import { llmService } from './llmService.js';

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
		userConversation: string,
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
			buildChatCompletion('user', userConversation, profileInfo.showName),
		];

		const personaSchema = createPersonaResponseSchema(charName, userName, langCode);
		logFlow('personaEngine', 'createPersonaResponseSchema', { personaSchema });

		// --- 2. LLM Call ---
		const rawLlmResponse = await llmService.invokeLlm(
			messages,
			aiModelInfo,
			profileInfo.userId,
			options,
			personaSchema
		);

		// --- 3. Parsing and Correction Logic ---
		try {
			return JSON.parse(rawLlmResponse) as PersonaResponse;
		} catch (parsingError: any) {
			console.warn(`[personaEngine] Initial response failed parsing. Attempting self-correction.`);
			logFlow('personaEngine', 'correction.start', {
				rawResponse: rawLlmResponse,
				reason: parsingError.message,
			});

			try {
				const requiredSchema = '{"response": "string", "emotion": "string"}';
				const correctionPrompt = buildJsonCorrectionPrompt(
					rawLlmResponse,
					`The JSON was malformed. Reason: ${parsingError.message}.`,
					requiredSchema
				);
				const correctionMessages: ChatCompletionMessageParam[] = [
					buildChatCompletion(
						'user',
						`You are an expert at fixing malformed JSON. Please correct the following text to match the required schema. Your output must be ONLY the raw JSON object, with no markdown fences or other text.\n\n${correctionPrompt}`
					),
				];

				let correctedLlmResponse = await llmService.invokeLlm(
					correctionMessages,
					DEFAULT_EXTRACTION_MODEL,
					profileInfo.userId,
					options
				);

				// **THE FIX**: Clean the response from the correction model.
				// This regex removes the markdown fences (```json ... ```
				const jsonRegex = new RegExp('```json\\s*([\\s\\S]*?)\\s*```');
				const match = correctedLlmResponse.match(jsonRegex);
				if (match && match[1]) {
					correctedLlmResponse = match[1];
				}

				return JSON.parse(correctedLlmResponse) as PersonaResponse;
			} catch (correctionError: any) {
				console.error('[personaEngine] The self-correction attempt also failed.', {
					originalError: parsingError.message,
					correctionError: correctionError.message,
				});
				throw new Error(`Self-correction failed. Original raw response was: "${rawLlmResponse}"`);
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
				buildChatCompletion(
					'user',
					parseEntriesToConversation(turn.request.entries),
					turn.request.showName
				)
			);
		}

		// Add the assistant's (character's) response part of the turn, if it exists
		if (turn.response?.entries) {
			turnMessages.push(
				buildChatCompletion(
					'assistant',
					parseEntriesToConversation(turn.response.entries),
					turn.response.showName
				)
			);
		}

		return turnMessages;
	});
};
