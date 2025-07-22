import { supportAiModelInfo } from '../config/supportAiModelInfo.js';
import {
	AiModelInfo,
	AiPlatform,
	AiProvider,
	AllModelNames,
	DEFAULT_CHAT_MODEL_FREE,
	DEFAULT_RECAP_MODEL_FREE,
} from '../domain/aimodel/AiInfoTypes.js';

// src/shared/util/aiModelUtils.ts (CLIENT-SIDE REFACTORED)

// --- Constants (Client-safe) ---
const PLATFORM_OPENROUTER = 'openrouter';
const PLATFORM_LOCAL = 'local';
const DEFAULT_TEMPERATURE = 0.85;
const DEFAULT_MAX_TOKEN = 1500;

// --- Utility Functions (Client-Side Safe) ---

/**
 * Extracts models marked as ':free' from the supportAiModelInfo.
 * Does NOT include API keys.
 * @param platform - The platform to extract from (defaults to openrouter).
 * @returns Array of AiModelInfo for free models.
 */
const extractFreeModels = (platform: AiPlatform = PLATFORM_OPENROUTER): AiModelInfo[] => {
	const platformProviders = supportAiModelInfo[platform];
	if (!platformProviders) return [];

	if (platform === PLATFORM_OPENROUTER) {
		return Object.entries(platformProviders).flatMap(([provider, models]) =>
			models
				.filter((model) => model.endsWith(':free'))
				.map((model) => ({
					platform,
					provider: provider as AiProvider<'openrouter'>,
					model: model as AllModelNames,
					maxTokens: DEFAULT_MAX_TOKEN,
					temperature: DEFAULT_TEMPERATURE,
				}))
		);
	}
	// Add logic for other platforms if they have ':free' convention
	return [];
};

// Pre-calculate free models list (client-side)
export const freeAiModelInfos: AiModelInfo[] = extractFreeModels();

/**
 * Gets the AiModelInfo structure for a given model name based on supportAiModelInfo.
 * Does NOT include API keys. This is purely for identifying the model's details.
 * @param modelName - The full name of the model (e.g., 'openai/gpt-4o', 'google/gemini-pro:free', 'ollama/llama3').
 * @returns AiModelInfo structure without API key, or a default free model if not found.
 */
export const getAiModelInfo = (modelName: string): AiModelInfo => {
	try {
		// Handle OpenRouter format (provider/model-name)
		if (modelName.includes('/') && supportAiModelInfo[PLATFORM_OPENROUTER]) {
			const [provider, modelPart] = modelName.split('/');
			const fullModelNameInMap = modelName; // Use the full name for lookup

			// Use type assertion carefully or check provider existence first
			const providersForPlatform = supportAiModelInfo[PLATFORM_OPENROUTER];
			if (provider in providersForPlatform) {
				const modelsForProvider = providersForPlatform[provider as keyof typeof providersForPlatform];
				if (modelsForProvider?.includes(fullModelNameInMap as any)) {
					return {
						platform: PLATFORM_OPENROUTER,
						provider: provider as AiProvider<'openrouter'>,
						model: fullModelNameInMap as AllModelNames,
						maxTokens: DEFAULT_MAX_TOKEN,
						temperature: DEFAULT_TEMPERATURE,
						// No apiKey
					};
				}
			}
		}

		// Handle other platforms (direct, local)
		for (const [platform, providers] of Object.entries(supportAiModelInfo)) {
			// Skip openrouter as it was handled above
			if (platform === PLATFORM_OPENROUTER) continue;

			for (const [providerKey, models] of Object.entries(providers)) {
				// Ensure models is an array before calling includes
				if (Array.isArray(models) && models.includes(modelName as any)) {
					return {
						platform: platform as AiPlatform,
						provider: providerKey as AiProvider<typeof platform>,
						model: modelName as AllModelNames,
						maxTokens: DEFAULT_MAX_TOKEN,
						temperature: DEFAULT_TEMPERATURE,
					};
				}
			}
		}

		// Fallback if model not found
		console.warn(
			`Model "${modelName}" not found in supportAiModelInfo. Falling back to default free model.`
		);
		// Return default free model directly (ensure it's keyless)
		return DEFAULT_CHAT_MODEL_FREE;
	} catch (error) {
		console.error(`Error getting AI Model info for "${modelName}":`, error);
		// Fallback to a safe default in case of error
		return DEFAULT_CHAT_MODEL_FREE;
	}
};

/**
 * Determines the initial default AiModelInfo based on available free models.
 * Uses the pre-calculated freeAiModelInfos list.
 * @returns AiModelInfo for the determined default model (keyless).
 */
export const determineInitialDefaultAiInfo = (): AiModelInfo => {
	// Simplified: just use the constant if it's reliable
	return DEFAULT_CHAT_MODEL_FREE;
	// Or, if logic is needed based on freeAiModelInfos:
	// return freeAiModelInfos[0] || DEFAULT_CHAT_MODEL_FREE;
};

/**
 * Determines the default AiModelInfo for summary tasks.
 * @returns AiModelInfo for the summary model (keyless).
 */
export const determineDefaultSummaryAiInfo = (): AiModelInfo => {
	// Simplified: just use the constant
	return DEFAULT_RECAP_MODEL_FREE;
};

/**
 * Validates if an object structurally matches the AiModelInfo interface
 * and if the model is listed in the supportAiModelInfo configuration.
 * Does NOT check for API keys.
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
		typeof aiInfo.model !== 'string'
		// No apiKey check needed
	) {
		return false;
	}

	// Check if the model exists in the configuration
	const platform = aiInfo.platform as AiPlatform;
	const provider = aiInfo.provider as string; // Use string for lookup key
	const model = aiInfo.model as string;

	const providersForPlatform = supportAiModelInfo[platform];
	if (!providersForPlatform || !(provider in providersForPlatform)) {
		return false; // Platform or provider doesn't exist
	}
	const modelsForProvider = providersForPlatform[provider as keyof typeof providersForPlatform];

	return Array.isArray(modelsForProvider) && modelsForProvider.includes(model as any);
};
