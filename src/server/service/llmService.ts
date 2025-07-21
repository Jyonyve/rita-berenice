// src/server/services/aiService.ts
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import OpenAI from 'openai'; // For OpenRouter

import {
	ChatCompletionCreateParamsNonStreaming,
	ChatCompletionMessageParam,
} from 'openai/resources/index.mjs';
import { BaseMessage, SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages';

import { credentialStore } from '../store/credentialStore.js';
import { CredentialDataType } from '../db/ChromaInterfaces.js';
import {
	AiModelInfo,
	DEFAULT_CHAT_MODEL_FREE,
	DEFAULT_MODEL_GOOGLEAI,
} from '#shared/domain/aimodel/AiInfoTypes.js';
import { supportAiModelInfo } from '#shared/config/supportAiModelInfo.js';
import { ChatRoleType } from '#shared/domain/chat/ChatInterfaces.js';
import { extractValidOpenAiContent, isDirectOpenAIClient } from '../util/llmUtils.js';
import { convertMessageContentToString } from '#shared/util/chatParseUtils.js';
import { DEFAULT_EMOTION } from '#shared/config/emotionWordsMapper.js';
import { buildNerPrompt, buildTermTranslationPrompt } from '../util/templateUtils.js';

/**
 * A robust function to ensure message content is always a simple string.
 * It handles null, undefined, strings, and arrays of content parts.
 *
 * @param content The message content, which can be of various types.
 * @returns A simple string.
 */
export const normalizeMessageContent = (content: unknown) => {
	if (!content) {
		return '';
	}
	if (typeof content === 'string') {
		return content;
	}
	if (Array.isArray(content)) {
		// Handles cases like [{ type: 'text', text: 'Hello' }]
		return content.map((part) => (part.type === 'text' ? part.text : '')).join('');
	}
	// Fallback for any other unexpected type
	return '';
}; /**
 * A new, robust validation and sanitization function.
 * It will log the exact payload it receives and attempt to fix it.
 */
const sanitizeAndValidateMessages = (
	messages: any, // Intentionally 'any' to catch fundamental type errors
	modelName: string
): ChatCompletionMessageParam[] => {
	// ✅ DIAGNOSTIC LOGGING: This is the most important step.
	// It will show you exactly what the personaEngine is sending.
	console.log(
		`[llmService] Received messages payload for model ${modelName}. Type: ${typeof messages}`
	);
	if (typeof messages !== 'object' || messages === null) {
		console.log('Raw Payload Snippet:', String(messages).substring(0, 500));
	} else {
		console.log('Payload Structure:', JSON.stringify(messages, null, 2));
	}

	if (!Array.isArray(messages)) {
		throw new Error(
			`[llmService] Validation Failed: The 'messages' payload must be an array, but received type '${typeof messages}'. Check the calling service (e.g., personaEngine).`
		);
	}

	return messages
		.map((msg): ChatCompletionMessageParam | null => {
			if (typeof msg !== 'object' || msg === null || !msg.role) {
				console.warn('[llmService] Skipping invalid message object:', msg);
				return null;
			}

			// Ensure content is a string, handling null for tool calls
			const content = msg.content === null ? null : String(msg.content || '');

			return {
				role: msg.role,
				content: content,
				// Preserve other valid properties like tool_calls if they exist
				...(msg.tool_calls && { tool_calls: msg.tool_calls }),
			};
		})
		.filter((msg): msg is ChatCompletionMessageParam => msg !== null);
};

/**
 * Converts an array of OpenAI-formatted messages to LangChain's BaseMessage format.
 * This now uses the fully type-safe _normalizeMessageContent helper.
 */
const convertToLangChainMessages = (messages: ChatCompletionMessageParam[]): BaseMessage[] => {
	return messages.map((msg) => {
		// This is now fully type-safe, as _normalizeMessageContent accepts msg.content directly.
		const safeContent = normalizeMessageContent(msg.content);

		switch (msg.role) {
			case 'system':
				return new SystemMessage(safeContent);
			case 'user':
				return new HumanMessage(safeContent);
			case 'assistant':
				return new AIMessage(safeContent);
			default:
				console.warn(`[llmService] Unknown message role "${msg.role}", treating as human message.`);
				return new HumanMessage(safeContent);
		}
	});
};

export const llmService = {
	/**
	 * Creates an LLM instance based on the provided AI model info.
	 */
	createLlmInstance: async (
		aiInfo: AiModelInfo,
		userId: string
	): Promise<BaseChatModel | OpenAI> => {
		// --- 1. Destructure aiInfo to separate routing logic from LLM options ---
		const { platform, provider, ...llmOptions } = aiInfo; // llmOptions now holds { model, temperature, maxTokens, etc. }
		const { model } = llmOptions;

		// --- 2. Runtime Validation (Safety Net) ---
		const validModelsForProvider = supportAiModelInfo[platform]?.[provider];
		if (!Array.isArray(validModelsForProvider) || !validModelsForProvider.includes(model as never)) {
			throw new Error(
				`[llmService] Invalid model config. Model '${model}' is not supported for platform '${platform}' and provider '${provider}'.`
			);
		}
		console.log(`[llmService] Creating instance for: ${platform}/${provider}/${model}`);

		// --- 3. Credential Handling ---
		const userApiKeys = await credentialStore.getUserApiKeys(userId);
		try {
			// --- 4. Client Instantiation (Switch Statement) ---
			if (platform === 'openrouter') {
				if (!userApiKeys.openrouterApiKey) {
					throw new Error('[llmService] OpenRouter API key not found. Please configure your API keys.');
				}
				return new OpenAI({
					apiKey: userApiKeys.openrouterApiKey,
					baseURL: 'https://openrouter.ai/api/v1',
				});
			} else if (platform === 'direct') {
				switch (provider) {
					case 'openai':
						if (!userApiKeys.openaiApiKey) {
							throw new Error('[llmService] OpenAI API key not found. Please configure your API keys.');
						}
						return new ChatOpenAI({
							apiKey: userApiKeys.openaiApiKey,
							model,
							temperature: llmOptions.temperature,
							maxTokens: llmOptions.maxTokens,
						});
					case 'anthropic':
						if (!userApiKeys.anthropicApiKey) {
							throw new Error('[llmService] Anthropic API key not found. Please configure your API keys.');
						}
						return new ChatAnthropic({
							apiKey: userApiKeys.anthropicApiKey,
							model,
							temperature: llmOptions.temperature,
							maxTokens: llmOptions.maxTokens,
						});

					case 'google':
						if (!userApiKeys.googleApiKey) {
							throw new Error('[llmService] Google API key not found. Please configure your API keys.');
						}
						return new ChatGoogleGenerativeAI({
							apiKey: userApiKeys.googleApiKey,
							model,
							temperature: llmOptions.temperature,
							maxOutputTokens: llmOptions.maxTokens,
						});

					default:
						throw new Error(`[llmService] Unsupported provider: ${provider}`);
				}
			} else {
				throw new Error(`[llmService] Unsupported platform: ${platform}`);
			}
		} catch (error) {
			console.error(
				`[llmService] Failed to create LLM instance for ${platform}/${provider}/${model}:`,
				error
			);
			throw error;
		}
	},

	// `invokeLlm` is updated to accept the options object for consistency.
	invokeLlm: async (
		role: ChatRoleType,
		content: string,
		aiModelInfo: AiModelInfo,
		userId: string,
		options?: { signal?: AbortSignal } // Correctly accepts the AbortSignal
	): Promise<string> => {
		const { model, ...llmOptions } = aiModelInfo;
		const llmOrClient = await llmService.createLlmInstance(aiModelInfo, userId);
		const messages: ChatCompletionMessageParam[] = [{ role, content }];

		try {
			// ✅ USE THE NEW VALIDATION FUNCTION
			const sanitizedMessages = sanitizeAndValidateMessages(messages, aiModelInfo.model);

			if (sanitizedMessages.length === 0) {
				throw new Error(
					'[llmService] All messages were filtered out during sanitization. Aborting LLM call.'
				);
			}

			if (isDirectOpenAIClient(llmOrClient)) {
				const requestPayload: ChatCompletionCreateParamsNonStreaming = {
					...llmOptions,
					model,
					messages: sanitizedMessages,
					response_format: { type: 'json_object' },
				};

				console.log('[llmService] Full request payload being sent to OpenRouter:');
				console.log(JSON.stringify(requestPayload, null, 2));
				const completion = await llmOrClient.chat.completions.create(requestPayload, {
					signal: options?.signal,
				});
				return extractValidOpenAiContent(completion);
			} else {
				const langChainMessages = convertToLangChainMessages(sanitizedMessages);
				const responseMessage = await llmOrClient.invoke(langChainMessages, {
					signal: options?.signal,
				});
				return convertMessageContentToString(responseMessage.content);
			}
		} catch (error: any) {
			console.error(
				`[llmService.invokeLlm] Invocation failed for model '${aiModelInfo.model}':`,
				error
			);
			throw error;
		}
	},

	/**
	 * Invokes an LLM with a sequence of messages and returns the raw string response.
	 * This method now accepts an AbortSignal. The calling service (`personaEngine`)
	 * is responsible for parsing the expected JSON from the string.
	 */
	invokeLlmFromMessages: async (
		messages: ChatCompletionMessageParam[],
		aiModelInfo: AiModelInfo,
		userId: string,
		options?: { signal?: AbortSignal } // Correctly accepts the AbortSignal
	): Promise<string> => {
		const { model, ...llmOptions } = aiModelInfo;
		const llmOrClient = await llmService.createLlmInstance(aiModelInfo, userId);

		try {
			const sanitizedMessages = messages.map((msg) => ({
				...msg,
				content: normalizeMessageContent(msg.content),
			}));

			// For OpenAI/OpenRouter, use native JSON mode for higher reliability.
			if (isDirectOpenAIClient(llmOrClient)) {
				const completion = await llmOrClient.chat.completions.create(
					{
						...llmOptions,
						model,
						messages: sanitizedMessages,
						// This strongly encourages OpenAI models to return valid JSON.
						response_format: { type: 'json_object' },
					},
					{ signal: options?.signal } // Pass the signal
				);
				return extractValidOpenAiContent(completion);
			} else {
				// For other models (Anthropic, Google), we rely on the prompt's instructions
				// to return JSON and simply return the raw text content.
				const langChainMessages = convertToLangChainMessages(messages);
				const responseMessage = await llmOrClient.invoke(langChainMessages, {
					signal: options?.signal, // Pass the signal
				});

				// Return the raw string for the personaEngine to parse.
				return convertMessageContentToString(responseMessage.content);
			}
		} catch (error: any) {
			console.error(
				`[llmService.invokeLlmFromMessages] Invocation failed for model '${aiModelInfo.model}':`,
				error
			);
			// Return a structured error string that can still be safely parsed by the personaEngine's JSON parser.
			return `{"response": "[LLM invocation error: ${error.message}]", "emotion": "${DEFAULT_EMOTION}"}`;
		}
	},

	// --- Specific Task Methods ---

	translateProperNoun: async (koreanTerm: string, userId: string): Promise<string> => {
		const aiModelInfo = DEFAULT_CHAT_MODEL_FREE;
		const prompt = buildTermTranslationPrompt(koreanTerm);
		const translation = await llmService.invokeLlm('user', prompt, aiModelInfo, userId);
		return translation.replace(/["'.]/g, '').trim(); // Clean the output
	},

	extractProperNouns: async (textToAnalyze: string, userId: string): Promise<string[]> => {
		const aiModelInfo = DEFAULT_MODEL_GOOGLEAI;
		const prompt = buildNerPrompt(textToAnalyze);
		const jsonResponse = await llmService.invokeLlm('user', prompt, aiModelInfo, userId);
		try {
			const potentialJson = jsonResponse.match(/{[\s\S]*?}|\[[\s\S]*?\]/)?.[0] || '[]';
			const nouns = JSON.parse(potentialJson);
			return Array.isArray(nouns) ? nouns.filter((n) => typeof n === 'string') : [];
		} catch {
			console.warn('[llmService.extractProperNouns] Failed to parse JSON response for NER.');
			return [];
		}
	},
};
