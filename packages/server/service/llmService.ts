// src/server/services/aiService.ts

import { get_encoding, Tiktoken } from 'tiktoken';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { ChatCompletionMessageParam } from 'openai/resources/index.mjs';
import { BaseMessage, SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages';

import { credentialStore } from '../store/credentialStore.js';
import { JSON_REPAIR_MODEL_TIER } from '@rita-berenice/shared/config';
import { resolveUtilityModelInfo, resolveUtilityModelInfoForKeyTypes } from '@rita-berenice/shared/util';

import {
  buildGlossaryExtractionPrompt,
  buildJsonCorrectionPrompt,
  buildNerPrompt,
  buildTermTranslationPrompt,
} from '../util/templateUtils.js';
import { flowLogger } from '../util/jsonlLogger.js';

import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import { buildChatCompletion, convertMessageContentToString } from '../util/llmUtils.js';
import {
  AiModelInfo,
  ApiError,
  ApiKeyError,
  API_KEY_TYPE_LABELS,
  DEFAULT_EXTRACTION_MODEL,
  getRequiredApiKeyType,
} from '@rita-berenice/shared/domain';
import { ZodObject, ZodType } from 'zod';
import { buildTokenBudget, TokenBudget } from '../util/tokenBudgetUtils.js';
import { parseStructuredLlmOutput, StructuredOutputValidationError } from '../util/structuredOutputUtils.js';
import { createGlossaryExtractionSchema, createNerSchema } from '../util/schemaUtils.js';

interface StructuredOutputRepairOptions {
  requiredSchema: string;
  /** The model that produced the malformed output. Repair is routed from it. */
  sourceModelInfo?: AiModelInfo;
  /** Explicit override, still honoured; it wins over the tier setting. */
  repairModelInfo?: AiModelInfo;
  signal?: AbortSignal;
}

const MAX_OUTPUT_CONTINUATIONS = 2;
const CONTINUATION_PROMPT =
  'Continue exactly where the previous output stopped. Return only the missing suffix of the same JSON object. Do not repeat any existing text and do not add markdown fences.';

export class OutputLengthLimitError extends StructuredOutputValidationError {
  constructor(rawOutput: string, options?: ErrorOptions) {
    super('The model still reached its output limit after continuation attempts.', rawOutput, options);
    this.name = 'OutputLengthLimitError';
  }
}

export const readLlmTerminationReason = (chunk: unknown): string | undefined => {
  const candidate = chunk as
    | {
        response_metadata?: Record<string, unknown>;
        responseMetadata?: Record<string, unknown>;
      }
    | undefined;
  const metadata = candidate?.response_metadata ?? candidate?.responseMetadata;
  if (!metadata) return undefined;
  const reason = metadata.finish_reason ?? metadata.finishReason ?? metadata.stop_reason ?? metadata.stopReason;
  return typeof reason === 'string' ? reason : undefined;
};

export const isOutputLengthTermination = (reason: string | undefined): boolean => {
  const normalized = reason?.toLowerCase().replace(/[\s-]+/g, '_');
  return normalized === 'length' || normalized === 'max_tokens' || normalized === 'max_output_tokens';
};

/**
 * Chooses the model that repairs malformed structured output.
 *
 * An explicit `repairModelInfo` always wins. Otherwise `JSON_REPAIR_MODEL_TIER` decides between
 * the utility tier and the model that produced the output; see that constant for why repair is
 * the one path here worth watching separately.
 */
const resolveRepairModelInfo = (repairOptions: StructuredOutputRepairOptions): AiModelInfo => {
  if (repairOptions.repairModelInfo) return repairOptions.repairModelInfo;
  if (!repairOptions.sourceModelInfo) return DEFAULT_EXTRACTION_MODEL;
  return JSON_REPAIR_MODEL_TIER === 'turn'
    ? repairOptions.sourceModelInfo
    : resolveUtilityModelInfo(repairOptions.sourceModelInfo.model);
};

const buildModelLogContext = (aiModelInfo: AiModelInfo, userId?: string): Record<string, unknown> => ({
  platform: aiModelInfo.platform,
  provider: aiModelInfo.provider,
  model: aiModelInfo.model,
  ...(userId ? { userId } : {}),
});

const normalizeMessageContent = (content: unknown): string => {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((part) => (part.type === 'text' ? part.text : '')).join('');
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
        flowLogger.warn('llmService', 'messageRole.unknown', { role: msg.role });
        return new HumanMessage({ content: msg.content as string });
    }
  });
};

const calculateTokenBudget = (messages: ChatCompletionMessageParam[], aiInfo: AiModelInfo): TokenBudget | null => {
  const encoding: Tiktoken = get_encoding('cl100k_base');
  try {
    const textToEncode = messages
      .map((message) => `role: ${message.role}\ncontent: ${normalizeMessageContent(message.content)}`)
      .join('\n');
    const inputTokens = encoding.encode(textToEncode).length;
    return buildTokenBudget(inputTokens, aiInfo);
  } finally {
    encoding.free();
  }
};

const nativeStructuredOutputProviders = new Set(['openai', 'anthropic', 'google']);

const shouldUseNativeStructuredOutput = (aiModelInfo: AiModelInfo, expectsJson: boolean): boolean =>
  expectsJson && aiModelInfo.platform === 'direct' && nativeStructuredOutputProviders.has(aiModelInfo.provider);

const addFormatInstructions = (
  messages: ChatCompletionMessageParam[],
  zodSchema: ZodType,
): ChatCompletionMessageParam[] => {
  const parser = StructuredOutputParser.fromZodSchema(zodSchema as any);
  return [buildChatCompletion('system', parser.getFormatInstructions()), ...messages];
};

const parseStructuredOutputWithLogging = <T>(
  rawOutput: string,
  zodSchema: ZodType<T>,
  context: Record<string, unknown>,
): T => {
  try {
    return parseStructuredLlmOutput(rawOutput, zodSchema);
  } catch (error) {
    if (error instanceof StructuredOutputValidationError) {
      flowLogger.warn('llmService', 'structuredOutput.parseFailed', {
        ...context,
        reason: error.message,
        rawOutputLength: error.rawOutput.length,
      });
    }
    throw error;
  }
};

const invokeStructuredLlmCore = async <T>(
  messages: ChatCompletionMessageParam[],
  aiModelInfo: AiModelInfo,
  userId: string,
  zodSchema: ZodType<T>,
  options?: { signal?: AbortSignal },
): Promise<T> => {
  const useStructuredOutput = shouldUseNativeStructuredOutput(aiModelInfo, true);
  const requestMessages = useStructuredOutput ? messages : addFormatInstructions(messages, zodSchema);
  const logContext = buildModelLogContext(aiModelInfo, userId);

  await llmService.validateTokenCount(requestMessages, aiModelInfo);

  const llmClient = await llmService.createLlmInstance(aiModelInfo, userId);
  const langChainMessages = convertToLangChainMessages(requestMessages);

  if (useStructuredOutput) {
    flowLogger.info('llmService', 'structuredOutput.native', {
      ...buildModelLogContext(aiModelInfo, userId),
      messageCount: requestMessages.length,
    });
    const structuredLlm = llmClient.withStructuredOutput(zodSchema, {
      name: 'json_output_tool',
      includeRaw: true,
    });
    const result = await structuredLlm.invoke(langChainMessages, { signal: options?.signal });

    if (result.parsed) {
      return parseStructuredOutputWithLogging(JSON.stringify(result.parsed), zodSchema, logContext);
    }

    const raw: AIMessage = result.raw;
    flowLogger.warn('llmService', 'structuredOutput.nativeParseFallback', {
      ...buildModelLogContext(aiModelInfo, userId),
    });
    return parseStructuredOutputWithLogging(convertMessageContentToString(raw.content), zodSchema, logContext);
  }

  flowLogger.info('llmService', 'structuredOutput.manual', {
    ...buildModelLogContext(aiModelInfo, userId),
    messageCount: requestMessages.length,
  });
  const responseMessage = await llmClient.invoke(langChainMessages, { signal: options?.signal });
  return parseStructuredOutputWithLogging(
    convertMessageContentToString(responseMessage.content),
    zodSchema,
    logContext,
  );
};

const streamStructuredLlmCore = async <T>(
  messages: ChatCompletionMessageParam[],
  aiModelInfo: AiModelInfo,
  userId: string,
  onRawDelta: (delta: string) => void,
  zodSchema: ZodType<T>,
  options?: { signal?: AbortSignal },
): Promise<T> => {
  const requestMessages = addFormatInstructions(messages, zodSchema);
  const logContext = buildModelLogContext(aiModelInfo, userId);

  await llmService.validateTokenCount(requestMessages, aiModelInfo);

  const llmClient = await llmService.createLlmInstance(aiModelInfo, userId);
  const langChainMessages = convertToLangChainMessages(requestMessages);
  let rawOutput = '';
  let continuationCount = 0;
  let streamMessages = langChainMessages;

  while (true) {
    let responseStream;
    try {
      responseStream = await llmClient.stream(streamMessages, { signal: options?.signal });
    } catch (error) {
      if (continuationCount > 0 && rawOutput) throw new OutputLengthLimitError(rawOutput, { cause: error });
      throw error;
    }
    let terminationReason: string | undefined;
    let streamedOutput = '';
    for await (const chunk of responseStream) {
      terminationReason = readLlmTerminationReason(chunk) ?? terminationReason;
      const delta = convertMessageContentToString(chunk.content);
      if (!delta) continue;
      streamedOutput += delta;
      rawOutput += delta;
      onRawDelta(delta);
    }

    if (!isOutputLengthTermination(terminationReason)) break;
    if (continuationCount >= MAX_OUTPUT_CONTINUATIONS) {
      try {
        return parseStructuredOutputWithLogging(rawOutput, zodSchema, logContext);
      } catch {
        throw new OutputLengthLimitError(rawOutput);
      }
    }

    continuationCount += 1;
    flowLogger.warn('llmService', 'structuredOutput.lengthContinuation', {
      ...logContext,
      continuationCount,
      rawOutputLength: rawOutput.length,
      terminationReason,
    });
    const continuationMessages: ChatCompletionMessageParam[] = [
      ...requestMessages,
      buildChatCompletion('assistant', rawOutput),
      buildChatCompletion('user', CONTINUATION_PROMPT),
    ];
    try {
      await llmService.validateTokenCount(continuationMessages, aiModelInfo);
    } catch (error) {
      throw new OutputLengthLimitError(rawOutput, { cause: error });
    }
    streamMessages = convertToLangChainMessages(continuationMessages);

    if (!streamedOutput) {
      throw new OutputLengthLimitError(rawOutput);
    }
  }

  return parseStructuredOutputWithLogging(rawOutput, zodSchema, logContext);
};

/**
 * 순수 LLM 호출 서비스.
 * 데이터의 내용을 가공하지 않으며, 오직 API 통신과 응답 반환 책임만 가집니다.
 */
/**
 * Recognises a provider refusing the user's key, so a wrong or expired key reads as such
 * instead of as a generic "LLM invocation failed".
 *
 * Each SDK reports this differently - OpenAI and Anthropic set `status`, Google only says
 * "API key not valid" in the message - so both the status and the text are inspected.
 * Returns undefined when the failure is anything else.
 */
const asProviderAuthError = (error: unknown, aiModelInfo: AiModelInfo): ApiKeyError | undefined => {
  const keyType = getRequiredApiKeyType(aiModelInfo.platform, aiModelInfo.provider as string | undefined);
  if (!keyType) return undefined;

  const candidate = error as
    | { status?: unknown; statusCode?: unknown; response?: { status?: unknown }; message?: unknown }
    | undefined;
  const status = [candidate?.status, candidate?.statusCode, candidate?.response?.status].find(
    (value) => typeof value === 'number',
  );
  const message = typeof candidate?.message === 'string' ? candidate.message : '';
  const looksUnauthorized =
    status === 401 ||
    status === 403 ||
    /(401|403)|unauthorized|invalid[_ ]api[_ ]key|api key not valid|incorrect api key|authentication[_ ]error/i.test(
      message,
    );

  return looksUnauthorized ? new ApiKeyError('rejected', keyType, API_KEY_TYPE_LABELS[keyType]) : undefined;
};

export const llmService = {
  /**
   * LLM 클라이언트 인스턴스를 생성합니다.
   */
  createLlmInstance: async (aiInfo: AiModelInfo, userId: string) => {
    const { platform, provider, model, temperature, maxTokens } = aiInfo;
    const userApiKeys = await credentialStore.getDecryptedUserApiKeys(userId);
    // Every chat request runs on the user's own key. There is deliberately no server-side
    // fallback: the server's OPENAI_API_KEY funds embeddings only, and letting chat borrow
    // it silently billed the operator for a user whose key was simply never registered.
    const requireUserKey = (keyValue: string | undefined): string => {
      const keyType = getRequiredApiKeyType(platform, provider as string | undefined);
      if (!keyType) {
        throw new ApiError(400, `[llmService] Unsupported platform/provider: ${platform}/${provider}`);
      }
      if (!keyValue) {
        throw new ApiKeyError('missing', keyType, API_KEY_TYPE_LABELS[keyType]);
      }
      return keyValue;
    };

    if (platform === 'openrouter') {
      const openrouterApiKey = requireUserKey(userApiKeys.openrouterApiKey);
      return new ChatOpenAI({
        apiKey: openrouterApiKey,
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
          return new ChatOpenAI({
            apiKey: requireUserKey(userApiKeys.openaiApiKey),
            model,
            temperature,
            maxTokens,
            user: userId,
          });
        case 'anthropic':
          return new ChatAnthropic({
            apiKey: requireUserKey(userApiKeys.anthropicApiKey),
            model,
            temperature,
            maxTokens,
          });
        case 'google':
          return new ChatGoogleGenerativeAI({
            apiKey: requireUserKey(userApiKeys.googleApiKey),
            model,
            temperature,
            maxOutputTokens: maxTokens,
          });
        default:
          throw new ApiError(400, `[llmService] Unsupported direct provider: ${provider}`);
      }
    }
    throw new ApiError(400, `[llmService] Unsupported platform: ${platform}`);
  },

  /**
   * Calculates and validates the token count for a request against the model's limit.
   * This version correctly throws an error on failure to halt execution.
   */
  validateTokenCount: async (messages: ChatCompletionMessageParam[], aiInfo: AiModelInfo): Promise<void> => {
    const budget = calculateTokenBudget(messages, aiInfo);
    if (!budget) {
      flowLogger.warn('llmService', 'tokenBudget.missingModelLimits', buildModelLogContext(aiInfo));
      return;
    }

    try {
      flowLogger.info('llmService', 'tokenBudget.validated', {
        ...buildModelLogContext(aiInfo),
        inputTokens: budget.inputTokens,
        reservedOutputTokens: budget.reservedOutputTokens,
        contextWindow: budget.contextWindow,
        availableInputTokens: budget.availableInputTokens,
      });

      if (budget.inputTokens > budget.availableInputTokens) {
        throw new Error(
          `Request exceeds context window. Input: ${budget.inputTokens}, ` +
            `reserved output: ${budget.reservedOutputTokens}, context: ${budget.contextWindow}.`,
        );
      }
    } catch (error: any) {
      flowLogger.error('llmService', 'tokenBudget.failed', {
        ...buildModelLogContext(aiInfo),
        error: error.message,
      });
      // **FIX**: Re-throw the error to stop the invokeLlm process immediately.
      throw new Error(`Token validation failed: ${error.message}`);
    }
  },

  /**
   * A hybrid LLM invocation function that uses the best strategy for each model type.
   */
  invokeStructuredLlm: async <T>(
    messages: ChatCompletionMessageParam[],
    aiModelInfo: AiModelInfo,
    userId: string,
    zodSchema: ZodType<T>,
    options?: { signal?: AbortSignal },
  ): Promise<T> => {
    return invokeStructuredLlmCore(messages, aiModelInfo, userId, zodSchema, options);
  },

  repairStructuredLlmOutput: async <T>(
    parsingError: StructuredOutputValidationError,
    userId: string,
    zodSchema: ZodType<T>,
    repairOptions: StructuredOutputRepairOptions,
  ): Promise<T> => {
    const repairModelInfo = resolveRepairModelInfo(repairOptions);
    const correctionPrompt = buildJsonCorrectionPrompt(
      parsingError.rawOutput,
      `The JSON was malformed. Reason: ${parsingError.message}.`,
      repairOptions.requiredSchema,
    );
    const correctionMessages: ChatCompletionMessageParam[] = [
      buildChatCompletion(
        'user',
        `You are an expert at fixing malformed JSON. Please correct the following text to match the required schema. Your output must be ONLY the raw JSON object, with no markdown fences or other text.\n\n${correctionPrompt}`,
      ),
    ];

    return llmService.invokeStructuredLlm(correctionMessages, repairModelInfo, userId, zodSchema, {
      signal: repairOptions.signal,
    });
  },

  invokeLlm: async (
    messages: ChatCompletionMessageParam[],
    aiModelInfo: AiModelInfo,
    userId: string,
    options?: { signal?: AbortSignal },
    zodSchema?: ZodObject,
  ): Promise<string> => {
    try {
      if (zodSchema) {
        return JSON.stringify(await invokeStructuredLlmCore(messages, aiModelInfo, userId, zodSchema, options));
      }

      await llmService.validateTokenCount(messages, aiModelInfo);

      const llmClient = await llmService.createLlmInstance(aiModelInfo, userId);
      const langChainMessages = convertToLangChainMessages(messages);
      const responseMessage = await llmClient.invoke(langChainMessages, { signal: options?.signal });
      return convertMessageContentToString(responseMessage.content);
    } catch (error: any) {
      if (error instanceof StructuredOutputValidationError) {
        throw error;
      }
      // An ApiError already carries a message meant for the user; re-wrapping it here
      // would bury it under the generic "invocation failed" text.
      if (error instanceof ApiError) {
        throw error;
      }
      const authError = asProviderAuthError(error, aiModelInfo);
      flowLogger.error('llmService', 'invoke.failed', {
        ...buildModelLogContext(aiModelInfo, userId),
        error: error.message,
        apiKeyRejected: authError !== undefined,
      });
      if (authError) {
        throw authError;
      }
      throw new Error(`[llmService] LLM invocation failed: ${error.message}`);
    }
  },

  /**
   * Streams raw model text while preserving the same final structured-output contract as invokeLlm.
   */
  streamStructuredLlm: async <T>(
    messages: ChatCompletionMessageParam[],
    aiModelInfo: AiModelInfo,
    userId: string,
    onRawDelta: (delta: string) => void,
    zodSchema: ZodType<T>,
    options?: { signal?: AbortSignal },
  ): Promise<T> => {
    return streamStructuredLlmCore(messages, aiModelInfo, userId, onRawDelta, zodSchema, options);
  },

  streamLlm: async (
    messages: ChatCompletionMessageParam[],
    aiModelInfo: AiModelInfo,
    userId: string,
    onRawDelta: (delta: string) => void,
    options?: { signal?: AbortSignal },
    zodSchema?: ZodObject,
  ): Promise<string> => {
    try {
      if (zodSchema) {
        return JSON.stringify(
          await streamStructuredLlmCore(messages, aiModelInfo, userId, onRawDelta, zodSchema, options),
        );
      }

      await llmService.validateTokenCount(messages, aiModelInfo);

      const llmClient = await llmService.createLlmInstance(aiModelInfo, userId);
      const langChainMessages = convertToLangChainMessages(messages);
      const responseStream = await llmClient.stream(langChainMessages, { signal: options?.signal });

      let rawOutput = '';
      for await (const chunk of responseStream) {
        const delta = convertMessageContentToString(chunk.content);
        if (!delta) continue;
        rawOutput += delta;
        onRawDelta(delta);
      }

      return rawOutput;
    } catch (error: unknown) {
      if (error instanceof StructuredOutputValidationError) {
        throw error;
      }
      if (error instanceof ApiError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown streaming error';
      const authError = asProviderAuthError(error, aiModelInfo);
      flowLogger.error('llmService', 'stream.failed', {
        ...buildModelLogContext(aiModelInfo, userId),
        error: message,
        apiKeyRejected: authError !== undefined,
      });
      if (authError) {
        throw authError;
      }
      throw new Error(`[llmService] LLM streaming failed: ${message}`, { cause: error });
    }
  },

  /**
   * Picks the utility model for work with no chat turn behind it, from the providers this user
   * has registered a key for.
   *
   * Reads key *metadata* only - `getUserApiKeyMetadata` never decrypts anything - so choosing a
   * model does not put a secret in scope. This exists because pinning these paths to
   * `DEFAULT_EXTRACTION_MODEL` reproduced the finalization incident somewhere else: an account
   * with only a Google key could chat but could not create a character.
   */
  resolveUserUtilityModelInfo: async (userId: string): Promise<AiModelInfo> => {
    const { configuredKeyTypes } = await credentialStore.getUserApiKeyMetadata(userId);
    const utilityModelInfo = resolveUtilityModelInfoForKeyTypes(configuredKeyTypes);
    flowLogger.info('llmService', 'utilityModel.resolvedFromKeys', {
      userId,
      configuredKeyCount: configuredKeyTypes.length,
      platform: utilityModelInfo.platform,
      provider: utilityModelInfo.provider,
      model: utilityModelInfo.model,
    });
    return utilityModelInfo;
  },

  /**
   * Translates a proper noun using the default free chat model.
   */
  translateProperNoun: async (koreanTerm: string, userId: string, utilityModelInfo?: AiModelInfo): Promise<string> => {
    const aiModelInfo = utilityModelInfo ?? DEFAULT_EXTRACTION_MODEL;
    const prompt = buildTermTranslationPrompt(koreanTerm);

    // MODIFIED: 'invokeLlm'에 맞게 messages 배열을 생성하여 전달합니다.
    const messages: ChatCompletionMessageParam[] = [{ role: 'user', content: prompt }];
    const translation = await llmService.invokeLlm(messages, aiModelInfo, userId);

    flowLogger.info('llmService', 'translateProperNoun.complete', {
      userId,
      termLength: koreanTerm.length,
      translationLength: translation.length,
    });

    // 번역 결과는 JSON이 아니므로, 일반 텍스트로 처리합니다.
    return translation.replace(/["'.]/g, '').trim();
  },

  /**
   * Extracts proper nouns from text using the default Google AI model.
   */
  extractProperNouns: async (
    textToAnalyze: string,
    userId: string,
    utilityModelInfo?: AiModelInfo,
  ): Promise<string[]> => {
    const aiModelInfo = utilityModelInfo ?? DEFAULT_EXTRACTION_MODEL;
    const prompt = buildNerPrompt(textToAnalyze);
    const nerSchema = createNerSchema();

    // MODIFIED: 'invokeLlm'에 맞게 messages 배열을 생성하여 전달합니다.
    const messages: ChatCompletionMessageParam[] = [{ role: 'user', content: prompt }];
    const nerResponse = await llmService.invokeStructuredLlm(messages, aiModelInfo, userId, nerSchema);

    flowLogger.info('llmService', 'extractProperNouns.complete', {
      userId,
      textLength: textToAnalyze.length,
      properNounCount: nerResponse.properNouns.length,
    });
    return nerResponse.properNouns;
  },

  extractGlossaryTerms: async (
    textToAnalyze: string,
    userId: string,
    utilityModelInfo?: AiModelInfo,
  ): Promise<Array<{ koreanTerm: string; englishTerm: string }>> => {
    const prompt = buildGlossaryExtractionPrompt(textToAnalyze);
    const response = await llmService.invokeStructuredLlm(
      [{ role: 'user', content: prompt }],
      utilityModelInfo ?? DEFAULT_EXTRACTION_MODEL,
      userId,
      createGlossaryExtractionSchema(),
    );
    const uniqueTerms = new Map<string, string>();
    response.terms.forEach(({ koreanTerm, englishTerm }) => {
      const korean = koreanTerm.trim();
      const english = englishTerm.trim();
      if (korean && english && !uniqueTerms.has(korean)) uniqueTerms.set(korean, english);
    });
    flowLogger.info('llmService', 'extractGlossaryTerms.complete', {
      userId,
      textLength: textToAnalyze.length,
      termCount: uniqueTerms.size,
    });
    return [...uniqueTerms].map(([koreanTerm, englishTerm]) => ({ koreanTerm, englishTerm }));
  },
};
