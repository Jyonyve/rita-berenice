export const SELECTABLE_MODEL_INFO: Record<string, Record<string, string[]>> = {
	openrouter: {
		anthropic: ['anthropic/claude-sonnet-5', 'anthropic/claude-sonnet-4.6'],
		google: ['google/gemini-3.1-pro-preview', 'google/gemini-3.5-flash'],
		openai: ['openai/gpt-5.6-sol', 'openai/gpt-5.6-terra'],
	},
	direct: {
		openai: ['gpt-5.6', 'gpt-5.6-terra', 'gpt-5.6-sol', 'gpt-5.6-luna'],
		anthropic: ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5-20251001'],
		google: ['gemini-2.5-pro', 'gemini-3.1-pro-preview', 'gemini-3.6-flash', 'gemini-3.7-flash'],
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

const CLAUDE_OPUS_5_LIMITS = { ...CLAUDE_SONNET_LIMITS, supportsTemperature: false } as const;

// The only Claude tier that is not 1M/128k. Unlike the 5-family it has no adaptive
// thinking, so temperature stays supported (the default).
const CLAUDE_HAIKU_4_5_LIMITS = {
	contextWindow: 200_000,
	maxOutputTokens: 64_000,
	recommendedOutputTokens: 8_192,
} as const;

// Every Gemini tier currently offered - 2.5-pro through 3.7-flash - publishes the same
// 1,048,576 input / 65,536 output limits, so one constant covers them all.
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
	'claude-opus-5': CLAUDE_OPUS_5_LIMITS,
	'claude-sonnet-5': CLAUDE_SONNET_5_LIMITS,
	'claude-haiku-4-5-20251001': CLAUDE_HAIKU_4_5_LIMITS,
	// Kept although no longer selectable: sessions and logs still reference it, and a known
	// good limit set is cheaper to keep than to re-derive if it is ever offered again.
	'claude-sonnet-4-6': CLAUDE_SONNET_LIMITS,
	'google/gemini-3.1-pro-preview': GEMINI_3_LIMITS,
	'google/gemini-3.5-flash': GEMINI_3_LIMITS,
	'gemini-3.1-pro-preview': GEMINI_3_LIMITS,
	'gemini-2.5-pro': GEMINI_3_LIMITS,
	// Kept although dropped from the direct list, same reasoning as claude-sonnet-4-6.
	'gemini-3.5-flash': GEMINI_3_LIMITS,
	'gemini-3.6-flash': GEMINI_3_LIMITS,
	'gemini-3.7-flash': GEMINI_3_LIMITS,
	'openai/gpt-5.6-sol': GPT_5_6_LIMITS,
	'openai/gpt-5.6-terra': GPT_5_6_LIMITS,
	'gpt-5.6': GPT_5_6_LIMITS,
	'gpt-5.6-terra': GPT_5_6_LIMITS,
	'gpt-5.6-sol': GPT_5_6_LIMITS,
	'gpt-5.6-luna': GPT_5_6_LIMITS,
	'gpt-4o-mini': { contextWindow: 128_000, maxOutputTokens: 16_384, recommendedOutputTokens: 2_048 },
};

export const correctAiModelInfo: Record<string, Record<string, string[]>> = {
	openrouter: {
		anthropic: ['anthropic/claude-sonnet-4.6'],
		google: ['google/gemini-3.5-flash'],
		openai: ['openai/gpt-5.6-terra'],
	},
} as const;
