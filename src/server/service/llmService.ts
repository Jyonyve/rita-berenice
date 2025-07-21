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
import {
	AiModelInfo,
	DEFAULT_CHAT_MODEL_FREE,
	DEFAULT_MODEL_GOOGLEAI,
} from '#shared/domain/aimodel/AiInfoTypes.js';
import { supportAiModelInfo } from '#shared/config/supportAiModelInfo.js';
import { ChatRoleType } from '#shared/domain/chat/ChatInterfaces.js';
import { extractValidOpenAiContent, isDirectOpenAIClient } from '../util/llmUtils.js';
import { convertMessageContentToString } from '#shared/util/chatParseUtils.js';
import { buildNerPrompt, buildTermTranslationPrompt } from '../util/templateUtils.js';

/**
 * Ensures message content is always a string.
 * Handles null, undefined, strings, and arrays of content parts.
 */
export const normalizeMessageContent = (content: unknown): string => {
	if (!content) return '';
	if (typeof content === 'string') return content;
	if (Array.isArray(content))
		// Handles cases like [{ type: 'text', text: 'Hello' }]
		return content.map((part) => (part.type === 'text' ? part.text : '')).join('');
	return '';
};

/**
 * Final, aggressive sanitization function that rebuilds the message array.
 * Guarantees the payload sent to the API is correctly structured.
 */
const reconstructMessagesForApi = (
	messages: any[],
	modelName: string
): ChatCompletionMessageParam[] => {
	console.log(`[llmService] Reconstructing payload for model: ${modelName}`);

	if (!Array.isArray(messages)) {
		throw new Error(
			`[llmService] Validation Failed: The 'messages' payload must be an array. Received type: ${typeof messages}. Check the calling service.`
		);
	}

	const reconstructed: ChatCompletionMessageParam[] = [];

	for (const msg of messages) {
		if (typeof msg !== 'object' || msg === null || !msg.role) {
			console.warn('[llmService] Skipping invalid message entry:', msg);
			continue;
		}
		const content = String(msg.content || '');
		const newMsg: ChatCompletionMessageParam = { role: msg.role, content };
		if (typeof msg.name === 'string' && msg.name) (newMsg as any).name = msg.name;
		reconstructed.push(newMsg);
	}

	console.log(
		`[llmService] Payload reconstruction complete. Total valid messages: ${reconstructed.length}`
	);
	console.log('Payload:', JSON.stringify(reconstructed, null, 2));

	return reconstructed;
};

/**
 * Converts OpenAI-formatted messages to LangChain's BaseMessage format.
 */
const convertToLangChainMessages = (messages: ChatCompletionMessageParam[]): BaseMessage[] => {
	return messages.map((msg) => {
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
		const { platform, provider, ...llmOptions } = aiInfo;
		const { model } = llmOptions;

		// Runtime validation
		const validModelsForProvider = supportAiModelInfo[platform]?.[provider];
		if (!Array.isArray(validModelsForProvider) || !validModelsForProvider.includes(model as never)) {
			throw new Error(
				`[llmService] Invalid model config. Model '${model}' is not supported for platform '${platform}' and provider '${provider}'.`
			);
		}
		console.log(`[llmService] Creating instance for: ${platform}/${provider}/${model}`);
		const userApiKeys = await credentialStore.getUserApiKeys(userId);

		try {
			// Client instantiation
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

	/**
	 * Invokes an LLM with a single message and returns the response.
	 * Accepts an optional AbortSignal via options.
	 */
	invokeLlm: async (
		role: ChatRoleType,
		content: string,
		aiModelInfo: AiModelInfo,
		userId: string,
		options?: { signal?: AbortSignal }
	): Promise<string> => {
		const { model, ...llmOptions } = aiModelInfo;
		const llmOrClient = await llmService.createLlmInstance(aiModelInfo, userId);
		const messages: ChatCompletionMessageParam[] = [{ role, content }];

		try {
			const sanitizedMessages = reconstructMessagesForApi(messages, aiModelInfo.model);
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
	 * Accepts an AbortSignal. The calling service parses the expected JSON from the string.
	 */
	invokeLlmFromMessages: async (
		messages: ChatCompletionMessageParam[],
		aiModelInfo: AiModelInfo,
		userId: string,
		options?: { signal?: AbortSignal }
	): Promise<string> => {
		const { model, ...llmOptions } = aiModelInfo;

		try {
			const sanitizedMessages = reconstructMessagesForApi(messages, aiModelInfo.model);
			const llmOrClient = await llmService.createLlmInstance(aiModelInfo, userId);

			if (isDirectOpenAIClient(llmOrClient)) {
				const completion = await llmOrClient.chat.completions.create({
					...llmOptions,
					model,
					messages: sanitizedMessages,
					response_format: { type: 'json_object' },
				});
				return extractValidOpenAiContent(completion);
			} else {
				// For Anthropic, Google, rely on the prompt's instructions to return JSON.
				const langChainMessages = convertToLangChainMessages(messages);
				const responseMessage = await llmOrClient.invoke(langChainMessages, {
					signal: options?.signal,
				});
				return convertMessageContentToString(responseMessage.content);
			}
		} catch (error: any) {
			console.error(
				`[llmService.invokeLlmFromMessages] Invocation failed for model '${aiModelInfo.model}':`,
				error
			);
			throw new Error(`[invokeLlmFromMessages] LLM invocation failed: ${error.message}`);
		}
	},

	// --- Specific Task Methods ---

	/**
	 * Translates a proper noun using the default free chat model.
	 * Cleans the model output.
	 */
	translateProperNoun: async (koreanTerm: string, userId: string): Promise<string> => {
		const aiModelInfo = DEFAULT_CHAT_MODEL_FREE;
		const prompt = buildTermTranslationPrompt(koreanTerm);
		const translation = await llmService.invokeLlm('user', prompt, aiModelInfo, userId);
		return translation.replace(/["'.]/g, '').trim();
	},

	/**
	 * Extracts proper nouns from text using the default Google AI model.
	 */
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
