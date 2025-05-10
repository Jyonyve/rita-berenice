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
} from '#root/src/shared/index.ts';
import { credentialService } from './credentialService.ts';
import { ChatCompletionMessageParam } from 'openai/resources/index.mjs';
import { BaseMessage, SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages';

const convertToLangChainMessages = (
	messages: { role: string; content: string }[]
): BaseMessage[] => {
	return messages.map((msg) => {
		switch (msg.role) {
			case 'system':
				return new SystemMessage(msg.content);
			case 'user':
				return new HumanMessage(msg.content);
			case 'assistant':
				return new AIMessage(msg.content);
			default:
				console.warn(`Unknown message role "${msg.role}", treating as human message.`);
				return new HumanMessage(msg.content);
		}
	});
};

export const llmService = {
	createLlmInstance: async (aiInfo: AiModelInfo): Promise<BaseChatModel | OpenAI> => {
		//
		const { platform, provider, model } = aiInfo;
		const credentials = await credentialService.getUserSecret();

		if (!credentials) {
			// Allow fallback to local/free models if credentials aren't set up *at all*
			console.warn(
				'Credentials not found. Only local or free models without key requirements will work.'
			);
		}

		// Helper to get a specific key or throw if required
		const getRequiredApiKey = (keyName: CredentialDataType): string => {
			const key = credentials?.[keyName];
			if (!key) {
				throw new Error(
					`Required API key "${keyName}" not found in user credentials for model ${platform}/${provider}/${model}. Please configure credentials.`
				);
			}
			return key;
		};

		try {
			switch (platform) {
				case 'direct': {
					let apiKey: string;
					switch (provider) {
						case 'openai':
							apiKey = getRequiredApiKey('OPENAI_API_KEY');
							return new ChatOpenAI({ model, apiKey });
						case 'anthropic':
							apiKey = getRequiredApiKey('ANTHROPIC_API_KEY');
							return new ChatAnthropic({ model, apiKey });
						case 'google':
							apiKey = getRequiredApiKey('GOOGLE_API_KEY');
							return new ChatGoogleGenerativeAI({ model, apiKey });
						default:
							throw new Error(`Unsupported direct provider: ${provider}`);
					}
				}

				case 'openrouter': {
					const apiKey = getRequiredApiKey('OPENROUTER_API_KEY');
					// Langchain doesn't have a dedicated OpenRouter class, use OpenAI client config
					// Note: Langchain's ChatOpenAI *can* take baseURL, but using OpenAI client is common for OR
					return new OpenAI({
						baseURL: 'https://openrouter.ai/api/v1',
						apiKey: apiKey,
						defaultHeaders: {
							'HTTP-Referer': 'https://github.com/Jyonyve/rita-berenice', // Optional but recommended by OpenRouter
							'X-Title': 'Rita Berenice', // Optional
						},
						// Dangerously allow browser = true; // THIS IS DANGEROUS if you ever ran this client-side by mistake
					});
				}

				case 'local': {
					const localUrl = process.env.LOCAL_AI_URL;
					return new ChatOllama({ model, ...(localUrl && { baseUrl: localUrl }) });
				}

				default:
					throw new Error(`Unsupported AI platform: ${platform} for model ${model}.`);
			}
		} catch (error) {
			console.error(`Failed to create LLM instance for ${platform}/${provider}/${model}:`, error);
			// Re-throw the error to be handled by the calling API route
			throw error;
		}
	},

	invokeLlm: async (
		role: ChatRoleType,
		content: string,
		aiModelInfo: AiModelInfo
	): Promise<string> => {
		const llmOrClient = await llmService.createLlmInstance(aiModelInfo);
		let responseContent = '';
		const messages = [{ role, content }];

		try {
			if (isDirectOpenAIClient(llmOrClient)) {
				console.log(`Invoking direct OpenAI client (${aiModelInfo.model})`);
				const completion = await llmOrClient.chat.completions.create({
					model: aiModelInfo.model,
					messages,
				});
				responseContent = extractValidOpenAiContent(completion);
			} else {
				// LangChain: convert to BaseMessage[]
				console.log(`Invoking LangChain model (${aiModelInfo.model})`);
				const langchainMessages = convertToLangChainMessages(messages);
				const responseMessage = await llmOrClient.invoke(langchainMessages);
				responseContent = convertMessageContentToString(responseMessage.content);
			}

			if (!responseContent) {
				console.warn(`LLM invocation (${aiModelInfo.model}) resulted in empty response.`);
				return '[LLM returned empty content]';
			}

			return responseContent;
		} catch (error) {
			console.error(`LLM invocation failed for ${aiModelInfo.model}:`, error);
			throw new Error(`LLM invocation failed: ${error || 'Unknown error'}`);
		}
	},

	invokeLlmFromMessages: async (
		messages: ChatCompletionMessageParam[], // Accepts OpenAI format
		aiModelInfo: AiModelInfo
	): Promise<string> => {
		// Returns JSON string
		const llmOrClient = await llmService.createLlmInstance(aiModelInfo);

		try {
			if (isDirectOpenAIClient(llmOrClient)) {
				console.log(`Invoking direct OpenAI client (${aiModelInfo.model}) for messages`);
				const completion = await llmOrClient.chat.completions.create({
					model: aiModelInfo.model,
					messages,
					response_format: { type: 'json_object' }, // <--- Ensure JSON mode is requested
				});
				const content = extractValidOpenAiContent(completion);
				if (!content || !content.trim().startsWith('{')) {
					// Basic check if it looks like JSON
					console.warn(
						`Direct OpenAI client (${aiModelInfo.model}) returned non-JSON or empty content: ${content}`
					);
					return JSON.stringify({
						response: content || '[LLM returned empty content]',
						emotion: DEFAULT_EMOTION,
					}); // Fallback JSON
				}
				return content; // Expecting JSON string
			} else {
				// Assumes LangChain BaseChatModel
				console.log(`Invoking LangChain model (${aiModelInfo.model}) for messages`);
				const langChainMessages = convertToLangChainMessages(messages as any); // Use helper

				const responseMessage = await llmOrClient.invoke(langChainMessages, {
					// Try adding response_format here if supported by the specific LangChain model wrapper
					// response_format: { type: 'json_object' }, // Check Langchain docs
				});
				const content = convertMessageContentToString(responseMessage.content);

				if (!content) {
					console.warn(`LangChain model (${aiModelInfo.model}) returned empty content.`);
					return JSON.stringify({ response: '[LLM returned empty content]', emotion: DEFAULT_EMOTION }); // Fallback JSON
				}
				// Check if the response looks like JSON
				if (content.trim().startsWith('{') && content.trim().endsWith('}')) {
					return content;
				} else {
					console.warn(
						`LangChain model (${aiModelInfo.model}) did not return expected JSON format. Response: ${content}`
					);
					// Wrap non-JSON response in expected structure
					return JSON.stringify({ response: content, emotion: DEFAULT_EMOTION }); // Fallback JSON
				}
			}
		} catch (error: any) {
			console.error(`LLM invocation failed for ${aiModelInfo.model} in invokeLlmFromMessages:`, error);
			// Return a JSON string indicating the error for PersonaEngine to parse
			return JSON.stringify({
				response: `[LLM invocation error: ${error.message || 'Unknown error'}]`,
				emotion: DEFAULT_EMOTION,
			});
		}
	},
};
