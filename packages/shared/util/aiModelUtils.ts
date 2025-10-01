// src/shared/util/aiModelUtils.ts

import { MODEL_LIMITS_INFO, SUPPORTED_MODEL_INFO } from '../config/supportAiModelInfo.js';
import {
	AiModelInfo,
	AiPlatform,
	AiProvider,
	AllModelNames,
	DEFAULT_EXTRACTION_MODEL,
} from '../domain/aimodel/AiInfoTypes.js';

// --- Constants (Client-safe) ---
const PLATFORM_OPENROUTER = 'openrouter';
const PLATFORM_LOCAL = 'local';
const DEFAULT_TEMPERATURE = 0.85;
const DEFAULT_MAX_TOKEN = 1500;

/**
 * Gets the AiModelInfo structure for a given model name based on supportAiModelInfo.
 * Does NOT include API keys. This is purely for identifying the model's details.
 * @param modelName - The full name of the model (e.g., 'openai/gpt-4o', 'google/gemini-pro:free', 'ollama/llama3').
 * @returns AiModelInfo structure without API key, or a default free model if not found.
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
			if (modelLimits?.maxOutputTokens) {
				return modelLimits.maxOutputTokens;
			}
			return DEFAULT_MAX_TOKEN;
		};

		// Handle OpenRouter format (provider/model-name)
		if (modelName.includes('/') && SUPPORTED_MODEL_INFO[PLATFORM_OPENROUTER]) {
			const [providerPart, modelPart] = modelName.split('/');

			const providersForPlatform = SUPPORTED_MODEL_INFO[PLATFORM_OPENROUTER];
			if (providerPart in providersForPlatform) {
				const modelsForProvider =
					providersForPlatform[providerPart as keyof typeof providersForPlatform];
				if (Array.isArray(modelsForProvider) && modelsForProvider.includes(modelName as any)) {
					return {
						platform: PLATFORM_OPENROUTER,
						provider: providerPart,
						model: modelName,
						maxTokens: getMaxTokens(),
						temperature: DEFAULT_TEMPERATURE,
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
						temperature: DEFAULT_TEMPERATURE,
					} as AiModelInfo;
				}
			}
		}

		// Fallback if model not found
		console.warn(
			`Model "${modelName}" not found in supportAiModelInfo. Falling back to default free model.`
		);
		return DEFAULT_EXTRACTION_MODEL;
	} catch (error) {
		console.error(`Error getting AI Model info for "${modelName}":`, error);
		return DEFAULT_EXTRACTION_MODEL;
	}
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
		console.warn(
			`maxTokens (${maxTokens}) exceeds model limit (${modelLimits.maxOutputTokens}) for ${model}`
		);
		return false;
	}

	// Additional validation: ensure maxTokens is reasonable (not too small)
	const minReasonableTokens = 100;
	if (maxTokens < minReasonableTokens) {
		console.warn(
			`maxTokens (${maxTokens}) is too small, minimum recommended: ${minReasonableTokens}`
		);
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
