// src/server/services/aiService.ts
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import OpenAI from 'openai'; // For OpenRouter

import { ChatCompletionMessageParam } from 'openai/resources/index.mjs';
import { BaseMessage, SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages';

import { credentialService } from '../credential/credentialService.js';
import { CredentialDataType } from '../db/ChromaInterfaces.js';
import { AiModelInfo, DEFAULT_MODEL_GOOGLEAI } from '#shared/domain/aimodel/AiInfoTypes.js';
import { supportAiModelInfo } from '#shared/config/supportAiModelInfo.js';
import { ChatRoleType } from '#shared/domain/chat/ChatInterfaces.js';
import { extractValidOpenAiContent, isDirectOpenAIClient } from '../util/llmUtils.js';
import { convertMessageContentToString } from '#shared/util/chatParseUtils.js';
import { DEFAULT_EMOTION } from '#shared/config/emotionWordsMapper.js';
import { buildNerPrompt, buildTermTranslationPrompt } from '../util/templateUtils.js';

const _normalizeMessageContent = (content: ChatCompletionMessageParam['content']): string => {
	// A simple check for any "falsy" value (null, undefined, '') will handle all edge cases.
	if (!content) {
		return '';
	}
	if (typeof content === 'string') {
		return content;
	}
	// If it's an array of parts, concatenate the text from each part.
	if (Array.isArray(content)) {
		return content.map((part) => (part.type === 'text' ? part.text : '')).join('');
	}
	return ''; // Fallback for any other unexpected type
};

/**
 * Converts an array of OpenAI-formatted messages to LangChain's BaseMessage format.
 * This now uses the fully type-safe _normalizeMessageContent helper.
 */
const convertToLangChainMessages = (messages: ChatCompletionMessageParam[]): BaseMessage[] => {
	return messages.map((msg) => {
		// This is now fully type-safe, as _normalizeMessageContent accepts msg.content directly.
		const safeContent = _normalizeMessageContent(msg.content);

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
	createLlmInstance: async (aiInfo: AiModelInfo): Promise<BaseChatModel | OpenAI> => {
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
		// const credentials = await credentialService.getUserSecret();
		const getRequiredApiKey = (keyName: CredentialDataType): string => {
			const key = process.env?.[keyName];
			if (!key) throw new Error(`Required API key "${keyName}" not found.`);
			return key;
		};

		// --- 4. Client Instantiation (Switch Statement) ---
		try {
			switch (platform) {
				case 'direct': {
					let apiKey: string;
					switch (provider) {
						case 'openai':
							apiKey = getRequiredApiKey('OPENAI_API_KEY');
							return new ChatOpenAI({ apiKey, ...llmOptions });
						case 'anthropic':
							apiKey = getRequiredApiKey('ANTHROPIC_API_KEY');
							return new ChatAnthropic({ apiKey, ...llmOptions });
						case 'google':
							apiKey = getRequiredApiKey('GOOGLE_API_KEY');
							return new ChatGoogleGenerativeAI({ ...llmOptions, apiKey });
					}
					break;
				}
				case 'openrouter': {
					const apiKey = getRequiredApiKey('OPENROUTER_API_KEY');
					return new OpenAI({
						baseURL: 'https://openrouter.ai/api/v1',
						apiKey: apiKey,
						defaultHeaders: {
							'HTTP-Referer': 'https://github.com/Jyonyve/rita-berenice',
							'X-Title': 'Rita Berenice',
						},
					});
				}
				// case 'local': {
				// 	const localUrl = process.env.LOCAL_AI_URL;
				// 	return new ChatOllama({ ...(localUrl && { baseUrl: localUrl }), ...llmOptions });
				// }
			}
			throw new Error(`Unsupported platform configuration: ${platform}`);
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
		options?: { signal?: AbortSignal } // Correctly accepts the AbortSignal
	): Promise<string> => {
		const { model, ...llmOptions } = aiModelInfo;
		const llmOrClient = await llmService.createLlmInstance(aiModelInfo);
		const messages: ChatCompletionMessageParam[] = [{ role, content }];

		try {
			if (isDirectOpenAIClient(llmOrClient)) {
				const completion = await llmOrClient.chat.completions.create({
					...llmOptions,
					model,
					messages, // Make sure this is properly formatted
					response_format: { type: 'json_object' },
				});
				return extractValidOpenAiContent(completion);
			} else {
				const langchainMessages = convertToLangChainMessages(messages);
				const responseMessage = await llmOrClient.invoke(langchainMessages, {
					signal: options?.signal, // Pass the signal
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
		options?: { signal?: AbortSignal } // Correctly accepts the AbortSignal
	): Promise<string> => {
		const { model, ...llmOptions } = aiModelInfo;
		const llmOrClient = await llmService.createLlmInstance(aiModelInfo);

		try {
			// For OpenAI/OpenRouter, use native JSON mode for higher reliability.
			if (isDirectOpenAIClient(llmOrClient)) {
				const completion = await llmOrClient.chat.completions.create(
					{
						...llmOptions,
						model,
						messages,
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

	translateProperNoun: async (koreanTerm: string): Promise<string> => {
		const aiModelInfo = DEFAULT_MODEL_GOOGLEAI;
		const prompt = buildTermTranslationPrompt(koreanTerm);
		const translation = await llmService.invokeLlm('user', prompt, aiModelInfo);
		return translation.replace(/["'.]/g, '').trim(); // Clean the output
	},

	extractProperNouns: async (textToAnalyze: string): Promise<string[]> => {
		const aiModelInfo = DEFAULT_MODEL_GOOGLEAI;
		const prompt = buildNerPrompt(textToAnalyze);
		const jsonResponse = await llmService.invokeLlm('user', prompt, aiModelInfo);
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
