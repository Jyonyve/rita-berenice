// src/server/services/aiService.ts

import { get_encoding, Tiktoken } from 'tiktoken';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import OpenAI from 'openai';

import { ChatCompletionMessageParam } from 'openai/resources/index.mjs';
import { BaseMessage, SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages';

import { credentialStore } from '../store/credentialStore.js';
import {
	AiModelInfo,
	DEFAULT_CHAT_MODEL_FREE,
	DEFAULT_MODEL_GOOGLEAI,
} from '#shared/domain/aimodel/AiInfoTypes.js';
import { MODEL_CONTEXT_WINDOWS } from '#shared/config/supportAiModelInfo.js';
import { ChatRoleType } from '#shared/domain/chat/ChatInterfaces.js';
import {
	isDirectOpenAIClient,
	parseLlmJsonResponse, // Assuming this is your preferred robust parser from llmUtils.js
} from '../util/llmUtils.js';
import { convertMessageContentToString } from '#shared/util/chatParseUtils.js';
import { buildNerPrompt, buildTermTranslationPrompt } from '../util/templateUtils.js';

// --- 저수준 유틸리티 함수 ---
// 이 함수들은 데이터의 '내용'을 변경하지 않고, '형식'을 보장하는 역할만 합니다.

const normalizeMessageContent = (content: unknown): string => {
	if (!content) return '';
	if (typeof content === 'string') return content;
	if (Array.isArray(content))
		return content.map((part) => (part.type === 'text' ? part.text : '')).join('');
	return '';
};

const reconstructMessagesForApi = (messages: any[]): ChatCompletionMessageParam[] => {
	if (!Array.isArray(messages)) {
		throw new Error('[llmService] Validation Failed: messages must be an array.');
	}
	const reconstructed: ChatCompletionMessageParam[] = [];
	for (const msg of messages) {
		if (typeof msg !== 'object' || msg === null || !msg.role) {
			console.warn('[llmService] Skipping invalid message entry:', msg);
			continue;
		}
		reconstructed.push({ role: msg.role, content: normalizeMessageContent(msg.content) });
	}
	return reconstructed;
};

const convertToLangChainMessages = (messages: ChatCompletionMessageParam[]): BaseMessage[] => {
	return messages.map((msg) => {
		switch (msg.role) {
			case 'system':
				return new SystemMessage({ content: msg.content as string });
			case 'user':
				return new HumanMessage({ content: msg.content as string });
			case 'assistant':
				return new AIMessage({ content: msg.content as string });
			default:
				console.warn(`[llmService] Unknown role "${msg.role}", treating as user.`);
				return new HumanMessage({ content: msg.content as string });
		}
	});
};

/**
 * 순수 LLM 호출 서비스.
 * 데이터의 내용을 가공하지 않으며, 오직 API 통신과 응답 반환 책임만 가집니다.
 */
export const llmService = {
	/**
	 * LLM 클라이언트 인스턴스를 생성합니다.
	 */
	createLlmInstance: async (
		aiInfo: AiModelInfo,
		userId: string
	): Promise<BaseChatModel | OpenAI> => {
		const { platform, provider, model, ...llmOptions } = aiInfo;
		const userApiKeys = await credentialStore.getUserApiKeys(userId);

		if (platform === 'openrouter') {
			if (!userApiKeys.openrouterApiKey) throw new Error('[llmService] OpenRouter API key not found.');
			return new OpenAI({
				apiKey: userApiKeys.openrouterApiKey,
				baseURL: 'https://openrouter.ai/api/v1',
			});
		}
		if (platform === 'direct') {
			switch (provider) {
				case 'openai':
					if (!userApiKeys.openaiApiKey) throw new Error('[llmService] OpenAI API key not found.');
					return new ChatOpenAI({ apiKey: userApiKeys.openaiApiKey, model, ...llmOptions });
				case 'anthropic':
					if (!userApiKeys.anthropicApiKey) throw new Error('[llmService] Anthropic API key not found.');
					return new ChatAnthropic({ apiKey: userApiKeys.anthropicApiKey, model, ...llmOptions });
				case 'google':
					if (!userApiKeys.googleApiKey) throw new Error('[llmService] Google API key not found.');
					return new ChatGoogleGenerativeAI({ apiKey: userApiKeys.googleApiKey, model, ...llmOptions });
				default:
					throw new Error(`[llmService] Unsupported direct provider: ${provider}`);
			}
		}
		throw new Error(`[llmService] Unsupported platform: ${platform}`);
	},

	/**
	 * Calculates and validates the token count for a request against the model's limit.
	 */
	validateTokenCount: async (
		messages: ChatCompletionMessageParam[],
		aiInfo: AiModelInfo
	): Promise<void> => {
		const { model } = aiInfo;
		const maxTokens = MODEL_CONTEXT_WINDOWS[model];
		if (!maxTokens) {
			console.warn(
				`[llmService.validateTokenCount] No context window size defined for ${model}. Skipping.`
			);
			return;
		}
		try {
			const encoding: Tiktoken = get_encoding('cl100k_base');
			const textToEncode = messages
				.map((msg) => `role: ${msg.role}\ncontent: ${normalizeMessageContent(msg.content)}`)
				.join('\n');
			const tokenCount = encoding.encode(textToEncode).length;
			encoding.free();
			console.log(
				`[llmService.validateTokenCount] Model: ${model}, Tokens: ${tokenCount}, Max: ${maxTokens}`
			);
			if (tokenCount >= maxTokens) {
				throw new Error(
					`[llmService] Request exceeds token limit for ${model}. Tokens: ${tokenCount}, Limit: ${maxTokens}.`
				);
			}
		} catch (error) {
			console.error('[llmService.validateTokenCount] Failed to count tokens with tiktoken:', error);
		}
	},

	/**
	 * 주어진 messages 배열을 사용하여 LLM API를 직접 호출하는 핵심 함수입니다.
	 */
	invokeLlm: async (
		messages: ChatCompletionMessageParam[],
		aiModelInfo: AiModelInfo,
		userId: string,
		options?: { signal?: AbortSignal }
	): Promise<string> => {
		try {
			await llmService.validateTokenCount(messages, aiModelInfo);
			const sanitizedMessages = reconstructMessagesForApi(messages);
			const llmOrClient = await llmService.createLlmInstance(aiModelInfo, userId);

			if (isDirectOpenAIClient(llmOrClient)) {
				// OpenRouter 경로는 SDK 호환성 문제를 피하기 위해 fetch를 사용합니다.
				console.log(`[llmService] Using native fetch for OpenRouter model: ${aiModelInfo.model}`);
				const userApiKeys = await credentialStore.getUserApiKeys(userId);
				if (!userApiKeys.openrouterApiKey)
					throw new Error('[llmService] OpenRouter API key not found.');

				const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${userApiKeys.openrouterApiKey}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						model: aiModelInfo.model,
						messages: sanitizedMessages, // 상위 서비스에서 가공된 messages를 그대로 전달
						temperature: aiModelInfo.temperature,
						response_format: { type: 'json_object' },
						max_tokens: aiModelInfo.maxTokens,
						user: userId,
					}),
					signal: options?.signal,
				});

				if (!response.ok) {
					const errorText = await response.text();
					throw new Error(`OpenRouter API request failed with status ${response.status}: ${errorText}`);
				}

				const responseData = await response.json();
				const rawContent = responseData?.choices?.[0]?.message?.content ?? '';
				const parsedObject = parseLlmJsonResponse(rawContent, 'llmService.invokeLlm');
				return JSON.stringify(parsedObject);
			} else {
				// Direct(LangChain) 경로는 .invoke()를 사용합니다.
				console.log(`[llmService] Using LangChain .invoke for direct model: ${aiModelInfo.model}`);
				const langChainMessages = convertToLangChainMessages(sanitizedMessages);
				const responseMessage = await llmOrClient.invoke(langChainMessages, {
					signal: options?.signal,
				});
				const rawContent = convertMessageContentToString(responseMessage.content);
				const parsedObject = parseLlmJsonResponse(rawContent, 'llmService.invokeLlm');
				return JSON.stringify(parsedObject);
			}
		} catch (error: any) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error(
				`[llmService.invokeLlm] Invocation failed for '${aiModelInfo.model}':`,
				errorMessage
			);
			throw new Error(`[llmService] LLM invocation failed: ${errorMessage}`);
		}
	},
	/**
	 * Translates a proper noun using the default free chat model.
	 */
	translateProperNoun: async (koreanTerm: string, userId: string): Promise<string> => {
		const aiModelInfo = DEFAULT_CHAT_MODEL_FREE;
		const prompt = buildTermTranslationPrompt(koreanTerm);

		// MODIFIED: 'invokeLlm'에 맞게 messages 배열을 생성하여 전달합니다.
		const messages: ChatCompletionMessageParam[] = [{ role: 'user', content: prompt }];
		const translation = await llmService.invokeLlm(messages, aiModelInfo, userId);

		// 번역 결과는 JSON이 아니므로, 일반 텍스트로 처리합니다.
		return translation.replace(/["'.]/g, '').trim();
	},

	/**
	 * Extracts proper nouns from text using the default Google AI model.
	 */
	extractProperNouns: async (textToAnalyze: string, userId: string): Promise<string[]> => {
		const aiModelInfo = DEFAULT_MODEL_GOOGLEAI;
		const prompt = buildNerPrompt(textToAnalyze);

		// MODIFIED: 'invokeLlm'에 맞게 messages 배열을 생성하여 전달합니다.
		const messages: ChatCompletionMessageParam[] = [{ role: 'user', content: prompt }];
		const jsonResponse = await llmService.invokeLlm(messages, aiModelInfo, userId);

		try {
			// invokeLlm은 이미 JSON 문자열을 반환하므로, 바로 파싱합니다.
			const parsed = JSON.parse(jsonResponse);
			return Array.isArray(parsed) ? parsed.filter((n) => typeof n === 'string') : [];
		} catch {
			console.warn('[llmService.extractProperNouns] Failed to parse JSON response for NER.');
			return [];
		}
	},
};
