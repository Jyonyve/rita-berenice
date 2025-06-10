// src/server/services/aiService.ts
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOllama } from '@langchain/ollama';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import OpenAI from 'openai'; // For OpenRouter

import {
	AiModelInfo,
	ChatRoleType,
	convertMessageContentToString,
	CredentialDataType,
	DEFAULT_EMOTION,
	extractValidOpenAiContent,
	isDirectOpenAIClient,
	supportAiModelInfo,
} from '#root/src/shared/index.ts';
import { credentialService } from './credentialService.ts';
import { ChatCompletionMessageParam } from 'openai/resources/index.mjs';
import { BaseMessage, SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { buildNerPrompt, buildTermTranslationPrompt } from '../util/index.ts';

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
		const credentials = await credentialService.getUserSecret();
		const getRequiredApiKey = (keyName: CredentialDataType): string => {
			const key = credentials?.[keyName];
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
				case 'local': {
					const localUrl = process.env.LOCAL_AI_URL;
					return new ChatOllama({ ...(localUrl && { baseUrl: localUrl }), ...llmOptions });
				}
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

	/**
	 * Invokes an LLM with a single prompt.
	 */
	invokeLlm: async (
		role: ChatRoleType,
		content: string,
		aiModelInfo: AiModelInfo
	): Promise<string> => {
		const { model, ...llmOptions } = aiModelInfo; // Separate model from other options
		const llmOrClient = await llmService.createLlmInstance(aiModelInfo);
		const messages: ChatCompletionMessageParam[] = [{ role, content }];

		try {
			if (isDirectOpenAIClient(llmOrClient)) {
				const completion = await llmOrClient.chat.completions.create({
					model,
					messages,
					...llmOptions, // Spread only the relevant options (temp, maxTokens)
				});
				return extractValidOpenAiContent(completion);
			} else {
				// For LangChain, options are already baked into the instance by createLlmInstance
				const langchainMessages = convertToLangChainMessages(messages);
				const responseMessage = await llmOrClient.invoke(langchainMessages);
				return convertMessageContentToString(responseMessage.content);
			}
		} catch (error: any) {
			console.error(
				`[llmService.invokeLlm] Invocation failed for model '${aiModelInfo.model}':`,
				error
			);
			throw new Error(`LLM invocation failed: ${error.message || 'Unknown error'}`);
		}
	},

	/**
	 * Invokes an LLM with a sequence of messages, expecting a JSON object.
	 */
	invokeLlmFromMessages: async (
		messages: ChatCompletionMessageParam[],
		aiModelInfo: AiModelInfo
	): Promise<string> => {
		const { model, ...llmOptions } = aiModelInfo; // Separate model from other options
		const llmOrClient = await llmService.createLlmInstance(aiModelInfo);

		try {
			if (isDirectOpenAIClient(llmOrClient)) {
				const completion = await llmOrClient.chat.completions.create({
					...llmOptions, // Spread options first
					model,
					messages,
					response_format: { type: 'json_object' }, // Specific option last
				});
				return extractValidOpenAiContent(completion);
			} else {
				const langChainMessages = convertToLangChainMessages(messages);
				const responseMessage = await llmOrClient.invoke(langChainMessages);
				const content = convertMessageContentToString(responseMessage.content);

				if (content && content.trim().startsWith('{')) return content;
				return JSON.stringify({ response: content, emotion: DEFAULT_EMOTION });
			}
		} catch (error: any) {
			console.error(
				`[llmService.invokeLlmFromMessages] Invocation failed for model '${aiModelInfo.model}':`,
				error
			);
			return JSON.stringify({
				response: `[LLM invocation error: ${error.message}]`,
				emotion: DEFAULT_EMOTION,
			});
		}
	},

	// --- Specific Task Methods ---

	translateProperNoun: async (koreanTerm: string): Promise<string> => {
		const aiModelInfo: AiModelInfo = {
			platform: 'direct',
			provider: 'google',
			model: 'gemini-1.5-flash-latest', // Ensure this model exists in your config
		};
		const prompt = buildTermTranslationPrompt(koreanTerm);
		const translation = await llmService.invokeLlm('user', prompt, aiModelInfo);
		return translation.replace(/["'.]/g, '').trim(); // Clean the output
	},

	extractProperNouns: async (textToAnalyze: string): Promise<string[]> => {
		const aiModelInfo: AiModelInfo = {
			platform: 'direct',
			provider: 'google',
			model: 'gemini-1.5-flash-latest', // Ensure this model exists
		};
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
