import { ModelCatalogEntry, ModelCatalogResponse } from '@rita-berenice/shared/api';
import { MODEL_LIMITS_INFO, SELECTABLE_MODEL_INFO } from '@rita-berenice/shared/config';
import { AiModelInfo, ApiError } from '@rita-berenice/shared/domain';
import { flowLogger } from '../util/jsonlLogger.js';
import { z } from 'zod';

const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
const CACHE_TTL_MS = 15 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5_000;
const RECOMMENDED_OUTPUT_TOKENS = 8_192;

const openRouterModelSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    created: z.number().default(0),
    context_length: z.number().int().positive(),
    supported_parameters: z.array(z.string()).default([]),
    top_provider: z
      .object({ max_completion_tokens: z.number().int().positive().nullable().optional() })
      .nullable()
      .optional(),
  })
  .passthrough();

const openRouterResponseSchema = z.object({ data: z.array(openRouterModelSchema) });
type OpenRouterModel = z.infer<typeof openRouterModelSchema>;

type CatalogLane =
  | 'anthropic-opus'
  | 'anthropic-sonnet'
  | 'anthropic-haiku'
  | 'google-pro'
  | 'google-flash'
  | 'openai-sol'
  | 'openai-terra';

const classifyModel = (modelId: string): { provider: ModelCatalogEntry['provider']; lane: CatalogLane } | null => {
  if (/^anthropic\/claude-opus-\d+(?:\.\d+)?$/.test(modelId)) {
    return { provider: 'anthropic', lane: 'anthropic-opus' };
  }
  if (/^anthropic\/claude-sonnet-\d+(?:\.\d+)?$/.test(modelId)) {
    return { provider: 'anthropic', lane: 'anthropic-sonnet' };
  }
  if (/^anthropic\/claude-haiku-\d+(?:\.\d+)?$/.test(modelId)) {
    return { provider: 'anthropic', lane: 'anthropic-haiku' };
  }
  if (/^google\/gemini-\d+(?:\.\d+)?-pro(?:-preview)?$/.test(modelId)) {
    return { provider: 'google', lane: 'google-pro' };
  }
  if (/^google\/gemini-\d+(?:\.\d+)?-flash(?:-preview)?$/.test(modelId)) {
    return { provider: 'google', lane: 'google-flash' };
  }
  if (/^openai\/gpt-\d+(?:\.\d+)?-sol$/.test(modelId)) {
    return { provider: 'openai', lane: 'openai-sol' };
  }
  if (/^openai\/gpt-\d+(?:\.\d+)?-terra$/.test(modelId)) {
    return { provider: 'openai', lane: 'openai-terra' };
  }
  return null;
};

const laneLimits: Record<CatalogLane, number> = {
  'anthropic-opus': 1,
  'anthropic-sonnet': 2,
  'anthropic-haiku': 1,
  'google-pro': 1,
  'google-flash': 1,
  'openai-sol': 1,
  'openai-terra': 1,
};

export const buildOpenRouterCatalogEntries = (input: unknown): ModelCatalogEntry[] => {
  const parsed = openRouterResponseSchema.parse(input);
  const candidates = parsed.data
    .map((model) => ({ model, classification: classifyModel(model.id) }))
    .filter(
      (
        item,
      ): item is {
        model: OpenRouterModel;
        classification: NonNullable<ReturnType<typeof classifyModel>>;
      } =>
        Boolean(item.classification) &&
        (item.model.supported_parameters.includes('structured_outputs') ||
          item.model.supported_parameters.includes('response_format')),
    )
    .sort((left, right) => right.model.created - left.model.created || left.model.id.localeCompare(right.model.id));

  const laneCounts = new Map<CatalogLane, number>();
  return candidates.flatMap(({ model, classification }) => {
    const count = laneCounts.get(classification.lane) ?? 0;
    if (count >= laneLimits[classification.lane]) return [];
    laneCounts.set(classification.lane, count + 1);

    const maxOutputTokens = model.top_provider?.max_completion_tokens ?? RECOMMENDED_OUTPUT_TOKENS;
    return [
      {
        id: model.id,
        name: model.name,
        platform: 'openrouter' as const,
        provider: classification.provider,
        contextWindow: model.context_length,
        maxOutputTokens,
        recommendedOutputTokens: Math.min(RECOMMENDED_OUTPUT_TOKENS, maxOutputTokens),
        supportsTemperature: model.supported_parameters.includes('temperature'),
        source: 'live' as const,
      },
    ];
  });
};

const buildFallbackEntries = (platform?: 'openrouter' | 'direct'): ModelCatalogEntry[] =>
  Object.entries(SELECTABLE_MODEL_INFO).flatMap(([platformName, providers]) => {
    if (platform && platformName !== platform) return [];
    return Object.entries(providers).flatMap(([provider, models]) =>
      models.map((id) => {
        const limits = MODEL_LIMITS_INFO[id];
        return {
          id,
          name: id.split('/').at(-1) ?? id,
          platform: platformName as ModelCatalogEntry['platform'],
          provider: provider as ModelCatalogEntry['provider'],
          contextWindow: limits.contextWindow,
          maxOutputTokens: limits.maxOutputTokens,
          recommendedOutputTokens: limits.recommendedOutputTokens,
          supportsTemperature: limits.supportsTemperature !== false,
          source: 'fallback' as const,
        };
      }),
    );
  });

export const modelCatalogEntryToAiModelInfo = (entry: ModelCatalogEntry): AiModelInfo =>
  ({
    platform: entry.platform,
    provider: entry.provider,
    model: entry.id,
    maxTokens: entry.recommendedOutputTokens,
    temperature: entry.supportsTemperature ? 0.85 : undefined,
  }) as AiModelInfo;

let cachedLiveEntries: { entries: ModelCatalogEntry[]; expiresAt: number; refreshedAt: string } | undefined;
let pendingRefresh: Promise<typeof cachedLiveEntries> | undefined;

const refreshLiveEntries = async (): Promise<typeof cachedLiveEntries> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(OPENROUTER_MODELS_URL, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`OpenRouter models request failed with ${response.status}.`);
    const entries = buildOpenRouterCatalogEntries(await response.json());
    if (!entries.length) throw new Error('OpenRouter models response contained no preferred models.');
    const refreshedAt = new Date().toISOString();
    cachedLiveEntries = { entries, expiresAt: Date.now() + CACHE_TTL_MS, refreshedAt };
    return cachedLiveEntries;
  } finally {
    clearTimeout(timeout);
  }
};

const getLiveEntries = async (): Promise<typeof cachedLiveEntries> => {
  if (cachedLiveEntries && cachedLiveEntries.expiresAt > Date.now()) return cachedLiveEntries;
  if (!pendingRefresh) {
    pendingRefresh = refreshLiveEntries()
      .catch((error) => {
        flowLogger.warn('modelCatalogService', 'catalog.refreshFailed', {
          error: error instanceof Error ? error.message : String(error),
          hasStaleCache: Boolean(cachedLiveEntries),
        });
        return cachedLiveEntries;
      })
      .finally(() => {
        pendingRefresh = undefined;
      });
  }
  return pendingRefresh;
};

export const modelCatalogService = {
  async getCatalog(): Promise<ModelCatalogResponse> {
    const live = await getLiveEntries();
    const fallbackDirect = buildFallbackEntries('direct');
    if (live?.entries.length) {
      return {
        models: [...live.entries, ...fallbackDirect],
        refreshedAt: live.refreshedAt,
        source: 'live',
      };
    }

    return {
      models: buildFallbackEntries(),
      refreshedAt: new Date().toISOString(),
      source: 'fallback',
    };
  },

  async resolveAiModelInfo(modelId: string): Promise<AiModelInfo> {
    const catalog = await this.getCatalog();
    const entry = catalog.models.find((model) => model.id === modelId);
    if (!entry) {
      throw new ApiError(
        400,
        `Unsupported AI model: ${modelId}`,
        'The selected AI model is unavailable. Refresh the model list and choose another model.',
      );
    }
    return modelCatalogEntryToAiModelInfo(entry);
  },
};
