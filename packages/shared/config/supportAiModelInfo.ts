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

/**
 * The model used for the utility calls that support a chat turn - metadata enrichment, NER,
 * glossary extraction, query translation - keyed by the platform and provider of the model that
 * produced the turn itself.
 *
 * These calls used to run unconditionally on `DEFAULT_EXTRACTION_MODEL` (direct/openai
 * `gpt-4o-mini`). That is a bug, not a cost choice: an account that chats on Google or OpenRouter
 * has no OpenAI key, so every utility call threw `ApiKeyError('missing', 'openaiApiKey')` and the
 * finalization job failed three times while the chat response itself had succeeded. Staying on the
 * turn's own platform keeps the whole request on the one key the user actually registered.
 *
 * Every entry must already exist in `SUPPORTED_MODEL_INFO` and `MODEL_LIMITS_INFO`; this map only
 * points at models, it never introduces one. Where a provider has no genuinely cheap tier on a
 * platform (OpenRouter's Anthropic and OpenAI lines), the cheapest *offered* model is used - the
 * point is key compatibility first, price second.
 */
export const UTILITY_MODEL_INFO: Record<string, Record<string, string>> = {
	openrouter: {
		anthropic: 'anthropic/claude-sonnet-4.6',
		google: 'google/gemini-3.5-flash',
		openai: 'openai/gpt-5.6-terra',
	},
	direct: {
		openai: 'gpt-4o-mini',
		anthropic: 'claude-haiku-4-5-20251001',
		google: 'gemini-3.6-flash',
	},
} as const;

/**
 * The order utility work falls back through when there is no turn to take a provider from.
 *
 * Character glossary scanning and the standalone NER/translation endpoints have no chat turn in
 * scope, so `UTILITY_MODEL_INFO` has nothing to key on. Leaving them pinned to
 * `DEFAULT_EXTRACTION_MODEL` reproduced the original incident at a different entry point: an
 * account with no OpenAI key could chat fine but could not create a character. The caller instead
 * walks this list and takes the first provider the user has actually registered a key for.
 *
 * `direct/openai` is first so that nothing changes for accounts that already have an OpenAI key -
 * they keep the same model and the same cost as before. The rest run direct before OpenRouter
 * (no routing markup) and cheap tiers before expensive ones.
 */
export const UTILITY_MODEL_PREFERENCE: ReadonlyArray<{ platform: string; provider: string }> = [
	{ platform: 'direct', provider: 'openai' },
	{ platform: 'direct', provider: 'google' },
	{ platform: 'direct', provider: 'anthropic' },
	{ platform: 'openrouter', provider: 'google' },
	{ platform: 'openrouter', provider: 'openai' },
	{ platform: 'openrouter', provider: 'anthropic' },
] as const;

/**
 * Which tier repairs a model's malformed JSON.
 *
 * `'utility'` keeps repair on the same key as everything else, which is why it is the default: a
 * user with only a Google key could otherwise have a repair attempt fail on a missing OpenAI key.
 * Repair is different in kind from the other utility calls, though - it asks a model to fix
 * another model's broken output, and a cheaper model may fix it less often. If repair failures
 * rise, flip this one constant to `'turn'` to repair on the model that produced the output. It is
 * deliberately the only switch needed to revert this path on its own.
 */
export const JSON_REPAIR_MODEL_TIER: 'utility' | 'turn' = 'utility';

export const correctAiModelInfo: Record<string, Record<string, string[]>> = {
	openrouter: {
		anthropic: ['anthropic/claude-sonnet-4.6'],
		google: ['google/gemini-3.5-flash'],
		openai: ['openai/gpt-5.6-terra'],
	},
} as const;
