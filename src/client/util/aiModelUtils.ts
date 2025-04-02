import {
	AiModelInfo,
	AiPlatform,
	supportAiModelInfo,
	AiProvider,
	AllModelNames,
	DEFAULT_LOCAL_MODEL,
	DEFAULT_FREE_MODEL,
} from '@client/domain/aimodel';
import OpenAI from 'openai';

// API key mapping focusing on OpenRouter
const API_KEY_MAP = {
	openrouter: 'VITE_OPENROUTER_API_KEY',
	openai: 'VITE_OPENAI_API_KEY',
	anthropic: 'VITE_ANTHROPIC_API_KEY',
	google: 'VITE_GEMINI_API_KEY',
};

const openrouter = 'openrouter';

export const isOpenAI = (llm: unknown): llm is OpenAI => {
	return llm instanceof OpenAI;
};

const getApiKey = (platform: AiPlatform): string => {
	const envKey =
		platform === openrouter
			? API_KEY_MAP.openrouter
			: API_KEY_MAP[platform as keyof typeof API_KEY_MAP];
	return import.meta.env[envKey];
};

const extractFreeModels = (platform: AiPlatform = openrouter): AiModelInfo[] =>
	Object.entries(supportAiModelInfo.openrouter).flatMap(([provider, models]) =>
		models
			.filter((model) => model.endsWith(':free'))
			.map((model) => ({
				platform,
				provider: provider as AiProvider<typeof platform>,
				model: model as AllModelNames,
				apiKey: getApiKey(platform),
			}))
	);

export const freeAiModelInfos = extractFreeModels();

const checkLocalAiRunning = async (): Promise<boolean> => {
	try {
		const response = await fetch(import.meta.env.LOCAL_AI_URL);
		return response.ok;
	} catch {
		return false;
	}
};

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
					apiKey: getApiKey(openrouter),
				};
			}
		}

		// Handle other platform models (no '/')
		for (const [platform, providers] of Object.entries(supportAiModelInfo)) {
			if (platform === openrouter) continue; // Skip openrouter as already checked

			for (const [provider, models] of Object.entries(providers)) {
				if (models.includes(modelName)) {
					return {
						platform: platform as AiPlatform,
						provider: provider as AiProvider<typeof platform>,
						model: modelName as AllModelNames,
						...(platform !== 'local' && { apiKey: getApiKey(platform) }),
					};
				}
			}
		}

		// Fallback to free models
		const freeModel =
			freeAiModelInfos.find((aiModelInfo) =>
				aiModelInfo.model.startsWith(modelName.substring(0, 3))
			) || freeAiModelInfos[0];
		return freeModel || DEFAULT_FREE_MODEL;
	} catch (error) {
		console.error('AI Model selection error:', error);
		throw error;
	}
};

export const determineInitialDefaultAiInfo = (preferredProvider = 'google'): AiModelInfo => {
	try {
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
	try {
		return getAiModelInfo(preferredModel);
	} catch (error) {
		console.error('Failed to get summary AI model:', error);
		return DEFAULT_FREE_MODEL;
	}
};

export const isValidAiModelInfo = (aiInfo: unknown): boolean =>
	!!aiInfo &&
	typeof aiInfo === 'object' &&
	'platform' in aiInfo &&
	'provider' in aiInfo &&
	'model' in aiInfo &&
	supportAiModelInfo[aiInfo.platform as AiPlatform]?.[aiInfo.provider as string]?.includes(
		aiInfo.model as string
	);

export const checkLocalRunning = async (): Promise<boolean> => {
	if (!(await checkLocalAiRunning())) {
		throw new Error('Local AI is not running. Please start Local AI server first.');
	}

	return true;
};
