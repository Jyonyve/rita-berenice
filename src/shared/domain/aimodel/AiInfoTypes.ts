import { supportAiModelInfo } from '../../config/supportAiModelInfo.ts'; //should export from file, not index(circular error)

// 2. Define types based on the new structure
export type AiPlatform = keyof typeof supportAiModelInfo;
export type AiProvider<P extends AiPlatform> = keyof (typeof supportAiModelInfo)[P];
export type AiModelName<
	P extends AiPlatform,
	Pr extends AiProvider<P>,
> = (typeof supportAiModelInfo)[P][Pr] extends readonly (infer M)[] ? M : never;

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
			maxTokens?: number;
		};
	}[AiProvider<P>]; // Gets the union of all provider objects for platform P
}[AiPlatform]; // Gets the union of all platform unions

// Get all sources
export const SupportAiPlatformList = Object.keys(supportAiModelInfo) as AiPlatform[];

// Get all model names (flattened)
export const SupportAiModelList = Object.values(supportAiModelInfo)
	.map((providers) => Object.values(providers).flat())
	.flat() as AllModelNames[]; // Fixed: Use proper type assertion

// 5. Define AiRole (remains unchanged)
export type DefaultAiRole = 'system' | 'user' | 'assistant';
export type AiRole = DefaultAiRole | 'custom';

export const DEFAULT_CHAT_MODEL_FREE: AiModelInfo = {
	platform: 'openrouter',
	provider: 'google',
	model: 'google/gemini-2.5-pro-exp-03-25:free',
};

export const DEFAULT_RECAP_MODEL_FREE: AiModelInfo = {
	platform: 'openrouter',
	provider: 'google',
	model: 'gemini-2.0-flash-001',
	temperature: 0.7,
	maxTokens: 5000,
};

export const DEFAULT_LOCAL_MODEL: AiModelInfo = {
	platform: 'local',
	provider: 'exaone',
	model: 'exaone-deep-2.4b',
};

export const METADATA_GENERATION_MODEL: AiModelInfo = {
	platform: 'googleai',
	provider: 'google',
	model: 'gemini-2.0-flash-001',
};
