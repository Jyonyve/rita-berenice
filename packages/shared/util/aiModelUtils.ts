// src/shared/util/aiModelUtils.ts

import {
  MODEL_LIMITS_INFO,
  SUPPORTED_MODEL_INFO,
  UTILITY_MODEL_INFO,
  UTILITY_MODEL_PREFERENCE,
} from '../config/supportAiModelInfo.js';
import {
  AllModelNames,
  AiModelInfo,
  ApiKeyType,
  DEFAULT_EXTRACTION_MODEL,
  AiPlatform,
  getRequiredApiKeyType,
} from '../domain/index.js';

// --- Constants (Client-safe) ---
const PLATFORM_OPENROUTER = 'openrouter';
const PLATFORM_LOCAL = 'local';
const DEFAULT_TEMPERATURE = 0.85;
const DEFAULT_MAX_TOKEN = 1500;

const getDefaultTemperature = (modelName: AllModelNames): number | undefined =>
  MODEL_LIMITS_INFO[modelName]?.supportsTemperature === false ? undefined : DEFAULT_TEMPERATURE;

/**
 * Gets the AiModelInfo structure for a given model name based on supportAiModelInfo.
 * Does NOT include API keys. This is purely for identifying the model's details.
 * @param modelName - The configured model name (for example, 'openai/gpt-5.6-terra' or 'gemini-3.5-flash').
 * @returns AiModelInfo structure without API key, or the balanced extraction model if not found.
 */
export const getAiModelInfo = (modelName: AllModelNames): AiModelInfo => {
  try {
    // First, check if we have token limits for this model
    const modelLimits = MODEL_LIMITS_INFO[modelName];
    if (!modelLimits) {
      console.warn(`No token limits found for model: ${modelName}`);
    }

    // Get the appropriate maxTokens
    const getMaxTokens = (): number => {
      if (modelLimits?.recommendedOutputTokens) {
        return modelLimits.recommendedOutputTokens;
      }
      return DEFAULT_MAX_TOKEN;
    };

    // Handle OpenRouter format (provider/model-name)
    if (modelName.includes('/') && SUPPORTED_MODEL_INFO[PLATFORM_OPENROUTER]) {
      const [providerPart, modelPart] = modelName.split('/');

      const providersForPlatform = SUPPORTED_MODEL_INFO[PLATFORM_OPENROUTER];
      if (providerPart in providersForPlatform) {
        const modelsForProvider = providersForPlatform[providerPart as keyof typeof providersForPlatform];
        if (Array.isArray(modelsForProvider) && modelsForProvider.includes(modelName as any)) {
          return {
            platform: PLATFORM_OPENROUTER,
            provider: providerPart,
            model: modelName,
            maxTokens: getMaxTokens(),
            temperature: getDefaultTemperature(modelName),
          } as AiModelInfo;
        }
      }
    }

    // Handle other platforms (direct, local, googleai, bedrock)
    for (const [platformKey, providers] of Object.entries(SUPPORTED_MODEL_INFO)) {
      // Skip openrouter as it was handled above
      if (platformKey === PLATFORM_OPENROUTER) continue;

      for (const [providerKey, models] of Object.entries(providers)) {
        if (Array.isArray(models) && models.includes(modelName as any)) {
          return {
            platform: platformKey,
            provider: providerKey,
            model: modelName,
            maxTokens: getMaxTokens(),
            temperature: getDefaultTemperature(modelName),
          } as AiModelInfo;
        }
      }
    }

    // Fallback if model not found
    console.warn(`Model "${modelName}" not found in supportAiModelInfo. Falling back to balanced extraction model.`);
    return DEFAULT_EXTRACTION_MODEL;
  } catch (error) {
    console.error(`Error getting AI Model info for "${modelName}":`, error);
    return DEFAULT_EXTRACTION_MODEL;
  }
};

/**
 * Utility calls run at a low temperature - they extract and translate, they do not perform.
 * Models that reject the parameter still get `undefined`.
 */
const UTILITY_TEMPERATURE = 0.3;

const getUtilityTemperature = (modelName: string): number | undefined =>
  MODEL_LIMITS_INFO[modelName]?.supportsTemperature === false ? undefined : UTILITY_TEMPERATURE;

/**
 * Derives platform and provider from a model name without requiring the model to be listed.
 *
 * The listed-model lookup in `getAiModelInfo` is not enough here: OpenRouter's catalog is fetched
 * live, so a turn can legitimately run on a model this file has never heard of. Falling back to
 * `DEFAULT_EXTRACTION_MODEL` for those would reintroduce exactly the cross-provider key failure
 * this resolution exists to prevent, so the OpenRouter `provider/model` shape is read directly.
 */
const parseModelOrigin = (modelName: string): { platform: string; provider: string } | undefined => {
  if (modelName.includes('/')) {
    const [providerPart] = modelName.split('/');
    return providerPart ? { platform: PLATFORM_OPENROUTER, provider: providerPart } : undefined;
  }

  for (const [platformKey, providers] of Object.entries(SUPPORTED_MODEL_INFO)) {
    if (platformKey === PLATFORM_OPENROUTER) continue;
    for (const [providerKey, models] of Object.entries(providers)) {
      if (Array.isArray(models) && models.includes(modelName)) {
        return { platform: platformKey, provider: providerKey };
      }
    }
  }
  return undefined;
};

const buildUtilityModelInfo = (platform: string, provider: string, modelName: string): AiModelInfo =>
  ({
    platform,
    provider,
    model: modelName,
    maxTokens: MODEL_LIMITS_INFO[modelName]?.recommendedOutputTokens ?? DEFAULT_MAX_TOKEN,
    temperature: getUtilityTemperature(modelName),
  }) as AiModelInfo;

/**
 * Picks the model for the utility calls that support a chat turn, from the model that produced
 * the turn.
 *
 * Resolution order, which is the whole point of the function:
 * 1. Read the turn model's platform and provider.
 * 2. Look them up in `UTILITY_MODEL_INFO`.
 * 3. With no mapping, fall back to the turn's own model - never to another provider's, because
 *    that is what left accounts without an OpenAI key unable to finalize a turn.
 *
 * Only a missing or unreadable turn model reaches `DEFAULT_EXTRACTION_MODEL`. Entry points with no
 * turn in scope use `resolveUtilityModelInfoForKeyTypes` instead.
 */
export const resolveUtilityModelInfo = (turnModelName?: string): AiModelInfo => {
  if (!turnModelName) return DEFAULT_EXTRACTION_MODEL;

  const origin = parseModelOrigin(turnModelName);
  if (!origin) return DEFAULT_EXTRACTION_MODEL;

  const utilityModelName = UTILITY_MODEL_INFO[origin.platform]?.[origin.provider] ?? turnModelName;

  return buildUtilityModelInfo(origin.platform, origin.provider, utilityModelName);
};

/**
 * Picks the utility model for work that has no chat turn to inherit a provider from - character
 * glossary scanning, the standalone NER and translation endpoints.
 *
 * Takes the key types the user has registered (never the keys themselves) and returns the first
 * entry in `UTILITY_MODEL_PREFERENCE` they can actually pay for. Falling back to
 * `DEFAULT_EXTRACTION_MODEL` when none match is deliberate: it leaves the existing "no OpenAI key
 * configured" error in place rather than inventing a different failure for a user who has
 * registered nothing at all.
 */
export const resolveUtilityModelInfoForKeyTypes = (configuredKeyTypes: readonly ApiKeyType[]): AiModelInfo => {
  const configured = new Set(configuredKeyTypes);

  for (const { platform, provider } of UTILITY_MODEL_PREFERENCE) {
    const keyType = getRequiredApiKeyType(platform, provider);
    if (!keyType || !configured.has(keyType)) continue;

    const modelName = UTILITY_MODEL_INFO[platform]?.[provider];
    if (!modelName) continue;

    return buildUtilityModelInfo(platform, provider, modelName);
  }

  return DEFAULT_EXTRACTION_MODEL;
};

/**
 * Validates if an object structurally matches the AiModelInfo interface
 * and if the model is listed in the supportAiModelInfo configuration.
 * Also validates that maxTokens is within the model's allowed limits.
 * @param aiInfo - The object to validate.
 * @returns True if the object is a valid AiModelInfo structure and the model is supported.
 */
export const isValidAiModelInfo = (aiInfo: unknown): aiInfo is AiModelInfo => {
  if (
    !aiInfo ||
    typeof aiInfo !== 'object' ||
    !('platform' in aiInfo) ||
    typeof aiInfo.platform !== 'string' ||
    !('provider' in aiInfo) ||
    typeof aiInfo.provider !== 'string' ||
    !('model' in aiInfo) ||
    typeof aiInfo.model !== 'string' ||
    !('maxTokens' in aiInfo) ||
    typeof aiInfo.maxTokens !== 'number' ||
    aiInfo.maxTokens <= 0
  ) {
    return false;
  }

  const platform = aiInfo.platform as AiPlatform;
  const provider = aiInfo.provider as string;
  const model = aiInfo.model as AllModelNames;
  const maxTokens = aiInfo.maxTokens;

  // Validate platform and provider exist
  const providersForPlatform = SUPPORTED_MODEL_INFO[platform];
  if (!providersForPlatform || !(provider in providersForPlatform)) {
    console.warn(`Platform "${platform}" or provider "${provider}" not found in configuration`);
    return false;
  }

  // Validate model exists for the provider
  const modelsForProvider = providersForPlatform[provider as keyof typeof providersForPlatform];
  if (!Array.isArray(modelsForProvider) || !modelsForProvider.includes(model as any)) {
    console.warn(`Model "${model}" not found for provider "${provider}" on platform "${platform}"`);
    return false;
  }

  // Validate maxTokens against model limits
  const modelLimits = MODEL_LIMITS_INFO[model];
  if (!modelLimits) {
    console.warn(`No token limits defined for model: ${model}. Allowing maxTokens: ${maxTokens}`);
    // Don't fail validation if limits aren't defined, just warn
    return maxTokens >= 100 && maxTokens <= 50000; // Reasonable bounds
  }

  // Check if maxTokens is within the model's maximum output token limit
  if (maxTokens > modelLimits.maxOutputTokens) {
    console.warn(`maxTokens (${maxTokens}) exceeds model limit (${modelLimits.maxOutputTokens}) for ${model}`);
    return false;
  }

  // Additional validation: ensure maxTokens is reasonable (not too small)
  const minReasonableTokens = 100;
  if (maxTokens < minReasonableTokens) {
    console.warn(`maxTokens (${maxTokens}) is too small, minimum recommended: ${minReasonableTokens}`);
    return false;
  }

  return true;
};

/**
 * Helper function to get safe maxTokens for a model
 * @param modelName - The model name
 * @param requestedTokens - Requested token count (optional)
 * @returns Safe token count within model limits
 */
export const getSafeMaxTokens = (modelName: AllModelNames, requestedTokens?: number): number => {
  const modelLimits = MODEL_LIMITS_INFO[modelName];
  if (!modelLimits) {
    const fallbackTokens = requestedTokens || DEFAULT_MAX_TOKEN;
    console.warn(`No limits found for ${modelName}, using fallback: ${fallbackTokens}`);
    return Math.min(fallbackTokens, 4096); // Safe upper bound
  }

  if (requestedTokens) {
    return Math.min(requestedTokens, modelLimits.maxOutputTokens);
  }

  return modelLimits.maxOutputTokens;
};
