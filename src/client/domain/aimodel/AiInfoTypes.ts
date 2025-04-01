import { supportAiModelInfo } from './supportAiModelInfo';

// 2. Define types based on the new structure
export type AiPlatform = keyof typeof supportAiModelInfo;
export type AiProvider<S extends AiPlatform> = keyof (typeof supportAiModelInfo)[S];
export type AiModelName<
	S extends AiPlatform,
	P extends AiProvider<S>,
> = (typeof supportAiModelInfo)[S][P] extends readonly string[]
	? (typeof supportAiModelInfo)[S][P][number]
	: never;

// Utility type to extract all models for a given source
type ModelsForPlatform<S extends AiPlatform> = {
	[P in AiProvider<S>]: AiModelName<S, P>;
}[AiProvider<S>];

// Utility type to get all possible model names
export type AllModelNames = { [S in AiPlatform]: ModelsForPlatform<S> }[AiPlatform];

// 3. Update AiModelInfo structure with proper provider typing
export interface AiModelInfo {
	platform: AiPlatform;
	provider: AiProvider<AiPlatform>; // Fixed: Make provider properly typed
	model: AllModelNames; // Fixed: Use AllModelNames type
	apiKey?: string;
}

// Get all sources
export const SupportAiPlatformList = Object.keys(supportAiModelInfo) as AiPlatform[];

// Get all model names (flattened)
export const SupportAiModelList = Object.values(supportAiModelInfo)
	.map((providers) => Object.values(providers).flat())
	.flat() as AllModelNames[]; // Fixed: Use proper type assertion

// 5. Define AiRole (remains unchanged)
export type DefaultAiRole = 'system' | 'user' | 'assistant';
export type AiRole = DefaultAiRole | 'custom';

export const DEFAULT_FREE_MODEL: AiModelInfo = {
	platform: 'openrouter',
	provider: 'google',
	model: 'google/gemini-2.0-flash-thinking-exp:free' as AllModelNames,
};

export const DEFAULT_LOCAL_MODEL: AiModelInfo = {
	platform: 'local',
	provider: 'exaone',
	model: 'exaone-deep-2.4b' as AllModelNames,
};
