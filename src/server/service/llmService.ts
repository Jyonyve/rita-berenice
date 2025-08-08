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
import { AiModelInfo, DEFAULT_EXTRACTION_MODEL } from '#shared/domain/aimodel/AiInfoTypes.js';
import { MODEL_LIMITS_INFO } from '#shared/config/supportAiModelInfo.js';
import { convertMessageContentToString } from '#shared/util/parseUtils.js';
import { buildNerPrompt, buildTermTranslationPrompt } from '../util/templateUtils.js';
import z from 'zod';

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
	createLlmInstance: async (aiInfo: AiModelInfo, userId: string): Promise<BaseChatModel> => {
		const { platform, provider, model, temperature, maxTokens } = aiInfo;
		const userApiKeys = await credentialStore.getUserApiKeys(userId);

		if (platform === 'openrouter') {
			if (!userApiKeys.openrouterApiKey) {
				throw new Error(`[llmService] API key for platform 'openrouter' not found.`);
			}
			return new ChatOpenAI({
				apiKey: userApiKeys.openrouterApiKey,
				model,
				temperature,
				maxTokens,
				configuration: {
					baseURL: 'https://openrouter.ai/api/v1',
					defaultHeaders: {
						'HTTP-Referer': 'https://github.com/Jyonyve/rita-berenice',
						'X-Title': 'Rita Berenice',
					},
				},
			});
		}

		// 2. Handle the 'direct' platform with its various providers
		if (platform === 'direct') {
			switch (provider) {
				case 'openai':
					if (!userApiKeys.openaiApiKey) throw new Error('[llmService] OpenAI API key not found.');
					return new ChatOpenAI({
						apiKey: userApiKeys.openaiApiKey,
						model,
						temperature,
						maxTokens,
						user: userId,
					});
				case 'anthropic':
					if (!userApiKeys.anthropicApiKey) throw new Error('[llmService] Anthropic API key not found.');
					return new ChatAnthropic({
						apiKey: userApiKeys.anthropicApiKey,
						model,
						temperature,
						maxTokens,
					});
				case 'google':
					if (!userApiKeys.googleApiKey) throw new Error('[llmService] Google API key not found.');
					return new ChatGoogleGenerativeAI({
						apiKey: userApiKeys.googleApiKey,
						model,
						temperature,
						maxOutputTokens: maxTokens,
					});
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
		const maxTokens = MODEL_LIMITS_INFO[model].maxOutputTokens;
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
	 * A generic LLM invocation function that supports optional structured output.
	 * If a Zod schema is provided, it enforces a JSON response. Otherwise, it
	 * returns a standard text response.
	 *
	 * @param messages - The array of messages for the LLM.
	 * @param aiModelInfo - The configuration for the selected AI model.
	 * @param userId - The ID of the user making the request.
	 * @param options - Optional parameters like an AbortSignal.
	 * @param zodSchema - An optional Zod schema to enforce structured JSON output.
	 * @returns A promise that resolves to a string, either plain text or a JSON string.
	 */
	invokeLlm: async (
		messages: ChatCompletionMessageParam[],
		aiModelInfo: AiModelInfo,
		userId: string,
		options?: { signal?: AbortSignal },
		zodSchema?: z.ZodObject<any> // The optional schema parameter
	): Promise<string> => {
		try {
			await llmService.validateTokenCount(messages, aiModelInfo);
			const sanitizedMessages = reconstructMessagesForApi(messages);
			const llmClient = await llmService.createLlmInstance(aiModelInfo, userId);
			const langChainMessages = convertToLangChainMessages(sanitizedMessages);

			// --- This is the core logic for flexible output ---
			if (zodSchema) {
				// If a schema is provided, use structured output.
				console.log(`[llmService] Invoking model with structured output (Zod schema)`);
				const structuredLlm = llmClient.withStructuredOutput(zodSchema);

				const structuredOutput = await structuredLlm.invoke(langChainMessages, {
					signal: options?.signal,
				});

				// The output is a guaranteed-to-be-valid JavaScript object.
				return JSON.stringify(structuredOutput);
			} else {
				// If no schema is provided, perform a standard text invocation.
				console.log(`[llmService] Invoking model with standard text output`);
				const responseMessage = await llmClient.invoke(langChainMessages, { signal: options?.signal });

				return convertMessageContentToString(responseMessage.content);
			}
		} catch (error: any) {
			if (error?.name === 'LlmResponseParseError') {
				throw error;
			}
			// For all other unexpected errors, log them and wrap them in a generic Error.
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error(
				`[llmService.invokeLlm] A non-parsing error occurred for '${aiModelInfo.model}':`,
				errorMessage
			);
			throw new Error(`[llmService] LLM invocation failed: ${errorMessage}`);
		}
	},

	/**
	 * Translates a proper noun using the default free chat model.
	 */
	translateProperNoun: async (koreanTerm: string, userId: string): Promise<string> => {
		const aiModelInfo = DEFAULT_EXTRACTION_MODEL;
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
		const aiModelInfo = DEFAULT_EXTRACTION_MODEL;
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
