import { MODEL_LIMITS_INFO, SUPPORTED_MODEL_INFO } from '../../config/index.js';

// 2. Define types based on the new structure
export type AiPlatform = keyof typeof SUPPORTED_MODEL_INFO;
export type AiProvider<P extends AiPlatform> = keyof (typeof SUPPORTED_MODEL_INFO)[P];
export type AiModelName<
  P extends AiPlatform,
  Pr extends AiProvider<P>,
> = (typeof SUPPORTED_MODEL_INFO)[P][Pr] extends readonly (infer M)[] ? M : never;

// Utility type to extract all models for a given source
type ModelsForPlatform<S extends AiPlatform> = {
  [P in AiProvider<S>]: AiModelName<S, P>;
}[AiProvider<S>];

// Utility type to get all possible model names
export type AllModelNames = { [S in AiPlatform]: ModelsForPlatform<S> }[AiPlatform];

// 3. Update AiModelInfo structure with proper provider typing
export type AiModelInfo = {
  [P in AiPlatform]: {
    [Pr in AiProvider<P>]: {
      platform: P;
      provider: Pr;
      model: AiModelName<P, Pr>;
      temperature?: number;
      maxTokens: number;
    };
  }[AiProvider<P>]; // Gets the union of all provider objects for platform P
}[AiPlatform]; // Gets the union of all platform unions

// Get all sources
export const SupportAiPlatformList = Object.keys(SUPPORTED_MODEL_INFO) as AiPlatform[];

// Get all model names (flattened)
export const SupportAiModelList = Object.values(SUPPORTED_MODEL_INFO)
  .map((providers) => Object.values(providers).flat())
  .flat() as AllModelNames[]; // Fixed: Use proper type assertion

// 5. Define AiRole (remains unchanged)
export type DefaultAiRole = 'system' | 'user' | 'assistant';

export const BALANCED_EXTRACTION_MODEL: AiModelInfo = {
  platform: 'direct',
  provider: 'openai',
  model: 'gpt-5.6-luna',
  maxTokens: MODEL_LIMITS_INFO['gpt-5.6-luna']?.recommendedOutputTokens || 8192,
};

// Keep the established name for callers while making the chosen quality tier explicit.
export const DEFAULT_EXTRACTION_MODEL: AiModelInfo = BALANCED_EXTRACTION_MODEL;
