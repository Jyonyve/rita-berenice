export const SELECTABLE_MODEL_INFO: Record<string, Record<string, string[]>> = {
	openrouter: {
		anthropic: ['anthropic/claude-sonnet-5', 'anthropic/claude-sonnet-4.6'],
		google: ['google/gemini-3.1-pro-preview', 'google/gemini-3.5-flash'],
		openai: ['openai/gpt-5.6-sol', 'openai/gpt-5.6-terra'],
	},
	direct: {
		openai: ['gpt-5.6', 'gpt-5.6-terra'],
		anthropic: ['claude-sonnet-5', 'claude-sonnet-4-6'],
		google: ['gemini-3.1-pro-preview', 'gemini-3.5-flash'],
	},
} as const;

export const DEFAULT_CHAT_MODEL = 'gpt-5.6-terra';

export const SUPPORTED_MODEL_INFO: Record<string, Record<string, string[]>> = {
	...SELECTABLE_MODEL_INFO,
	direct: {
		...SELECTABLE_MODEL_INFO.direct,
		openai: [...SELECTABLE_MODEL_INFO.direct.openai, 'gpt-4o-mini'],
	},
} as const;

const GPT_5_6_LIMITS = {
	contextWindow: 1_050_000,
	maxOutputTokens: 128_000,
	recommendedOutputTokens: 8_192,
	supportsTemperature: false,
} as const;

const CLAUDE_SONNET_LIMITS = {
	contextWindow: 1_000_000,
	maxOutputTokens: 128_000,
	recommendedOutputTokens: 8_192,
} as const;

const CLAUDE_SONNET_5_LIMITS = { ...CLAUDE_SONNET_LIMITS, supportsTemperature: false } as const;

const GEMINI_3_LIMITS = {
	contextWindow: 1_048_576,
	maxOutputTokens: 65_536,
	recommendedOutputTokens: 8_192,
} as const;

export const MODEL_LIMITS_INFO: Record<
	string,
	{
		contextWindow: number;
		maxOutputTokens: number;
		recommendedOutputTokens: number;
		supportsTemperature?: boolean;
	}
> = {
	'anthropic/claude-sonnet-5': CLAUDE_SONNET_5_LIMITS,
	'anthropic/claude-sonnet-4.6': CLAUDE_SONNET_LIMITS,
	'claude-sonnet-5': CLAUDE_SONNET_5_LIMITS,
	'claude-sonnet-4-6': CLAUDE_SONNET_LIMITS,
	'google/gemini-3.1-pro-preview': GEMINI_3_LIMITS,
	'google/gemini-3.5-flash': GEMINI_3_LIMITS,
	'gemini-3.1-pro-preview': GEMINI_3_LIMITS,
	'gemini-3.5-flash': GEMINI_3_LIMITS,
	'openai/gpt-5.6-sol': GPT_5_6_LIMITS,
	'openai/gpt-5.6-terra': GPT_5_6_LIMITS,
	'gpt-5.6': GPT_5_6_LIMITS,
	'gpt-5.6-terra': GPT_5_6_LIMITS,
	'gpt-4o-mini': { contextWindow: 128_000, maxOutputTokens: 16_384, recommendedOutputTokens: 2_048 },
};

export const correctAiModelInfo: Record<string, Record<string, string[]>> = {
	openrouter: {
		anthropic: ['anthropic/claude-sonnet-4.6'],
		google: ['google/gemini-3.5-flash'],
		openai: ['openai/gpt-5.6-terra'],
	},
} as const;
