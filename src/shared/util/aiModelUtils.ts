// src/shared/util/aiModelUtils.ts
import {
	AiModelInfo,
	AiPlatform,
	AiProvider,
	AllModelNames,
	DEFAULT_LOCAL_MODEL,
	DEFAULT_FREE_MODEL,
	supportAiModelInfo,
} from '@shared/index.ts'; // Ensure path is correct
import OpenAI from 'openai';

// Use standard server-side environment variable names (NO VITE_ prefix)
// These MUST match the names in your .env files (without VITE_)
const API_KEY_MAP = {
	openrouter: 'OPENROUTER_API_KEY',
	openai: 'OPENAI_API_KEY',
	anthropic: 'ANTHROPIC_API_KEY',
	google: 'GOOGLE_API_KEY', // Or GEMINI_API_KEY, matching your .env
	groq: 'GROQ_API_KEY', // Added Groq
	// Add other platforms like Bedrock if needed here
};

const openrouter = 'openrouter';
// Get Local AI URL from server-side environment variables
const LOCAL_AI_URL = process.env.LOCAL_AI_URL || 'http://localhost:11434/api/chat'; // Default if not set

export const isOpenAI = (llm: unknown): llm is OpenAI => {
	return llm instanceof OpenAI;
};

// Reads API key from server-side process.env
const getApiKey = (platform: AiPlatform): string => {
	const envKey =
		platform === openrouter
			? API_KEY_MAP.openrouter
			: API_KEY_MAP[platform as keyof typeof API_KEY_MAP];

	// Ensure envKey is valid before accessing process.env
	if (!envKey) {
		console.warn(`No API key mapping found for platform: ${platform}`);
		return ''; // Or throw an error if an API key is always expected
	}

	const apiKey = process.env[envKey]; // Read from process.env

	if (!apiKey) {
		console.warn(`API Key for ${platform} (${envKey}) is not defined in environment variables.`);
		// Depending on requirements, you might throw an error here:
		// throw new Error(`API Key for ${platform} (${envKey}) is required but not defined.`);
		return ''; // Return empty string if key is optional or handled elsewhere
	}
	return apiKey;
};

// Function to extract free models (uses getApiKey, which now reads process.env)
const extractFreeModels = (platform: AiPlatform = openrouter): AiModelInfo[] =>
	Object.entries(supportAiModelInfo.openrouter).flatMap(([provider, models]) =>
		models
			.filter((model) => model.endsWith(':free'))
			.map((model) => ({
				platform,
				provider: provider as AiProvider<typeof platform>,
				model: model as AllModelNames,
				apiKey: getApiKey(platform), // This will likely be empty or invalid for 'free' models unless handled specifically
			}))
	);

export const freeAiModelInfos = extractFreeModels();

// Function to check local AI status (uses LOCAL_AI_URL from process.env)
const checkLocalAiRunning = async (): Promise<boolean> => {
	try {
		// Use the variable derived from process.env
		const response = await fetch(LOCAL_AI_URL);
		return response.ok;
	} catch (error) {
		// It's common for fetch to fail if the server isn't running, log as warning
		console.warn('CheckLocalAiRunning: Failed to connect to Local AI URL:', LOCAL_AI_URL);
		return false;
	}
};

// --- Functions below use getApiKey, so they are now server-side compatible ---

export const getAiModelInfo = (modelName: string): AiModelInfo => {
	try {
		// Handle OpenRouter models (with '/')
		if (modelName.includes('/')) {
			const [provider, _] = modelName.split('/');
			const openrouterModels = supportAiModelInfo.openrouter[provider];

			if (openrouterModels?.includes(modelName)) {
				return {
					platform: openrouter,
					provider: provider as AiProvider<typeof openrouter>,
					model: modelName as AllModelNames,
					apiKey: getApiKey(openrouter), // Reads process.env
				};
			}
		}

		// Handle other platform models (no '/')
		for (const [platform, providers] of Object.entries(supportAiModelInfo)) {
			if (platform === openrouter) continue;

			for (const [provider, models] of Object.entries(providers)) {
				if (models.includes(modelName)) {
					return {
						platform: platform as AiPlatform,
						provider: provider as AiProvider<typeof platform>,
						model: modelName as AllModelNames,
						// Only add apiKey if it's not the 'local' platform
						...(platform !== 'local' && { apiKey: getApiKey(platform as AiPlatform) }), // Reads process.env
					};
				}
			}
		}

		// Fallback to free models (Note: apiKey might be empty/irrelevant here)
		const freeModel =
			freeAiModelInfos.find((aiModelInfo) =>
				aiModelInfo.model.startsWith(modelName.substring(0, 3))
			) || freeAiModelInfos[0];
		return freeModel || DEFAULT_FREE_MODEL;
	} catch (error) {
		console.error('AI Model selection error:', error);
		// Re-throwing allows upstream callers to handle it
		throw error;
	}
};

export const determineInitialDefaultAiInfo = (preferredProvider = 'google'): AiModelInfo => {
	// This function now uses getApiKey indirectly via freeAiModelInfos/DEFAULT_FREE_MODEL if needed
	try {
		// Finding logic remains the same, but underlying data relies on process.env for keys
		return (
			freeAiModelInfos.find((aiModelInfo) => aiModelInfo.provider.includes(preferredProvider)) ||
			DEFAULT_FREE_MODEL
		);
	} catch (error) {
		console.error('Failed to determine default AI info:', error);
		return DEFAULT_FREE_MODEL;
	}
};

export const determineDefaultSummaryAiInfo = (
	preferredModel = 'google/gemini-2.0-flash-thinking-exp:free'
): AiModelInfo => {
	// This function uses getAiModelInfo, which now reads process.env for keys
	try {
		return getAiModelInfo(preferredModel);
	} catch (error) {
		console.error('Failed to get summary AI model:', error);
		return DEFAULT_FREE_MODEL;
	}
};

// This function remains purely structural, no env var access
export const isValidAiModelInfo = (aiInfo: unknown): boolean =>
	!!aiInfo &&
	typeof aiInfo === 'object' &&
	'platform' in aiInfo &&
	'provider' in aiInfo &&
	'model' in aiInfo &&
	supportAiModelInfo[aiInfo.platform as AiPlatform]?.[aiInfo.provider as string]?.includes(
		aiInfo.model as string
	);

// This uses checkLocalAiRunning, which now reads process.env
export const checkLocalRunning = async (): Promise<boolean> => {
	if (!(await checkLocalAiRunning())) {
		// Consider if throwing an error is always desired, or if returning false is better
		console.error('Local AI is not running. Please start the Local AI server.');
		// throw new Error('Local AI is not running. Please start Local AI server first.');
		return false; // Return false might be more flexible
	}
	return true;
};
