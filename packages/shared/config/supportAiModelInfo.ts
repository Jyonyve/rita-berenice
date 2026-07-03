// 1. Define the new 3-level structure for supporting AI info
export const SUPPORTED_MODEL_INFO: Record<string, Record<string, string[]>> = {
	// local: { exaone: ['exaone-deep:2.4b'], google: ['gemma3:1b', 'gemma3:1b-Q6_K'] },
	openrouter: {
		anthropic: [
			'anthropic/claude-sonnet-4.5',
			'anthropic/claude-sonnet-4',
			'anthropic/claude-3.7-sonnet',
			'anthropic/claude-3.5-sonnet-20240620',
		],
		google: ['google/gemini-2.5-pro', 'google/gemini-2.5-flash-lite'],
		openai: ['openai/gpt-4o', 'openai/gpt-4.1', 'openai/gpt-5'],
		deepseek: ['deepseek/deepseek-chat-v3-0324:free'],
		mistralai: ['mistralai/mistral-small-3.2-24b-instruct:free'],
	},
	direct: {
		// Mapping previous types to direct providers
		openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-5'], // Previously 'gpt'
		anthropic: ['claude-3.7-sonnet', 'claude-3.5-haiku'], // Previously 'claude'
		google: [
			'gemini-2.0-flash-001',
			'gemini-2.0-flash-lite-001',
			'gemini-2.5-pro-preview-05-06',
			'gemini-2.5-flash-lite',
			'gemini-2.0-flash-live-preview-04-09',
		],
		groq: [],
	},
} as const;

export const MODEL_LIMITS_INFO: Record<
	string,
	{ contextWindow: number; maxOutputTokens: number; recommendedOutputTokens: number }
> = {
	// Anthropic Models (via OpenRouter)
	'anthropic/claude-3.5-sonnet-20240620': {
		contextWindow: 200_000,
		maxOutputTokens: 8_192,
		recommendedOutputTokens: 4_096,
	},
	'anthropic/claude-3-haiku-20240307': {
		contextWindow: 200_000,
		maxOutputTokens: 4_096,
		recommendedOutputTokens: 2_048,
	},
	// Aliases for user's config
	'anthropic/claude-sonnet-4.5': {
		contextWindow: 1_000_000, // 1M context (requires context-1m-2025-08-07 beta header), 200K standard
		maxOutputTokens: 64_000, // Up to 64K output tokens supported
		recommendedOutputTokens: 8_192, // Conservative recommendation for most use cases
	},

	'anthropic/claude-sonnet-4': {
		contextWindow: 200_000,
		maxOutputTokens: 8_192,
		recommendedOutputTokens: 4_096,
	},
	'anthropic/claude-3.7-sonnet': {
		contextWindow: 200_000,
		maxOutputTokens: 8_192,
		recommendedOutputTokens: 4_096,
	},
	'anthropic/claude-3.5-haiku': {
		contextWindow: 200_000,
		maxOutputTokens: 4_096,
		recommendedOutputTokens: 2_048,
	},

	// Google Models (via OpenRouter)
	'google/gemini-2.5-pro': {
		contextWindow: 1_048_576,
		maxOutputTokens: 8_192,
		recommendedOutputTokens: 4_096,
	},
	'google/gemini-2.5-flash-lite': {
		contextWindow: 1_048_576,
		maxOutputTokens: 8_192,
		recommendedOutputTokens: 2_048,
	},

	// OpenAI Models (via OpenRouter)
	'openai/gpt-4o': {
		contextWindow: 128_000,
		maxOutputTokens: 16_384,
		recommendedOutputTokens: 4_096,
	},
	'openai/gpt-4.1': {
		contextWindow: 1_047_576,
		maxOutputTokens: 16_384,
		recommendedOutputTokens: 4_096,
	},
	'openai/gpt-5': {
		contextWindow: 400_000,
		maxOutputTokens: 16_384,
		recommendedOutputTokens: 4_096,
	},
	'gpt-4o-mini': { contextWindow: 128_000, maxOutputTokens: 16_384, recommendedOutputTokens: 2_048 },
};

export const correctAiModelInfo: Record<string, Record<string, string[]>> = {
	openrouter: {
		anthropic: ['anthropic/claude-3.5-haiku'],
		google: ['google/gemini-2.5-flash-lite'],
		openai: ['openai/gpt-4o-mini'],
		deepseek: ['deepseek/deepseek-chat-v3-0324:free'],
		mistralai: ['mistralai/mistral-small-3.2-24b-instruct:free'],
	},
} as const;
