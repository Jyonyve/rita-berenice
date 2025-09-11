// src/server/services/aiService.ts

import { get_encoding, Tiktoken } from 'tiktoken';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

import util from 'util';
import { JsonOutputParser, StructuredOutputParser } from '@langchain/core/output_parsers';
import { ChatCompletionMessageParam } from 'openai/resources/index.mjs';
import { BaseMessage, SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages';

import { credentialStore } from '../store/credentialStore.js';
import { AiModelInfo, DEFAULT_EXTRACTION_MODEL } from '#shared/domain/aimodel/AiInfoTypes.js';
import { MODEL_LIMITS_INFO } from '#shared/config/supportAiModelInfo.js';
import { convertMessageContentToString } from '#shared/util/parseUtils.js';
import { buildNerPrompt, buildTermTranslationPrompt } from '../util/templateUtils.js';
import z, { ZodObject } from 'zod';
import { logFlow } from '../util/jsonlLogger.js';

import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import { buildChatCompletion, extractJsonFromLlmResponse } from '../util/llmUtils.js';

const normalizeMessageContent = (content: unknown): string => {
	if (!content) return '';
	if (typeof content === 'string') return content;
	if (Array.isArray(content))
		return content.map((part) => (part.type === 'text' ? part.text : '')).join('');
	return '';
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
	createLlmInstance: async (aiInfo: AiModelInfo, userId: string) => {
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
	 * This version correctly throws an error on failure to halt execution.
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
				throw new Error(`Request exceeds token limit. Tokens: ${tokenCount}, Limit: ${maxTokens}.`);
			}
		} catch (error: any) {
			console.error(
				'[llmService.validateTokenCount] A critical error occurred during token validation:',
				error.message
			);
			// **FIX**: Re-throw the error to stop the invokeLlm process immediately.
			throw new Error(`Token validation failed: ${error.message}`);
		}
	},

	/**
	 * A hybrid LLM invocation function that uses the best strategy for each model type.
	 */
	invokeLlm: async (
		messages: ChatCompletionMessageParam[],
		aiModelInfo: AiModelInfo,
		userId: string,
		options?: { signal?: AbortSignal },
		zodSchema?: ZodObject
	): Promise<string> => {
		// This flag determines if we should attempt to sanitize the output as JSON.
		const expectsJson = !!zodSchema;

		const useStructuredOutput =
			expectsJson && aiModelInfo.provider === 'google' && aiModelInfo.platform !== 'openrouter';

		try {
			const llmClient = await llmService.createLlmInstance(aiModelInfo, userId);
			let langChainMessages = convertToLangChainMessages(messages);

			let rawOutput: string; // This will hold the raw string from the LLM

			if (useStructuredOutput) {
				// --- STRATEGY 1: For Strict Models (Gemini) ---
				console.log(`[llmService] Using withStructuredOutput for model: ${aiModelInfo.model}`);
				const structuredLlm = llmClient.withStructuredOutput(zodSchema, {
					name: 'json_output_tool',
					includeRaw: true,
				});
				const result = await structuredLlm.invoke(langChainMessages, { signal: options?.signal });

				if (result.parsed) {
					rawOutput = JSON.stringify(result.parsed);
				} else {
					const raw: AIMessage = result.raw;
					console.warn('[llmService] Compliant model failed parsing. Falling back to raw text.');
					// The raw message content is the most likely place for the unparsed text
					rawOutput = convertMessageContentToString(raw.content);
				}
			} else {
				// --- STRATEGY 2: Manual Handling for Creative Models (Claude/GPT) ---
				console.log(`[llmService] Using manual parsing for model: ${aiModelInfo.model}`);
				if (zodSchema) {
					const parser = StructuredOutputParser.fromZodSchema(zodSchema as any);
					const formatInstructions = parser.getFormatInstructions();
					const guideParam = convertToLangChainMessages([
						buildChatCompletion('system', formatInstructions),
					]);
					langChainMessages = [...guideParam, ...langChainMessages];
				}

				const responseMessage = await llmClient.invoke(langChainMessages, { signal: options?.signal });
				rawOutput = convertMessageContentToString(responseMessage.content);
			}

			// --- 2. CENTRALIZED SANITIZATION ---
			// If we expected JSON, clean the output. Otherwise, return it as is.
			// This is the single point of sanitization for the entire application.
			if (expectsJson) {
				return extractJsonFromLlmResponse(rawOutput);
			}

			return rawOutput; // Return the raw text for non-JSON calls
		} catch (error: any) {
			console.error(
				`[llmService.invokeLlm] A critical, non-recoverable error occurred:`,
				error.message
			);
			throw new Error(`[llmService] LLM invocation failed: ${error.message}`);
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

		logFlow('llmService', 'translateProperNoun', { translation });

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

		logFlow('llmService', 'extractProperNouns', { jsonResponse });

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
