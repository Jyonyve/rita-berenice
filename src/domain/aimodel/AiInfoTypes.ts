import { supportingAiInfo } from '@util/aiTypeModelUtils';

export type SupportingAi = keyof typeof supportingAiInfo;
export type SupportingAiModel<T extends SupportingAi> = (typeof supportingAiInfo)[T][number];
type DefaultAiRole = 'system' | 'user' | 'assistant';
export type AiRole = DefaultAiRole | 'custom';

// Basic AI model information
interface BasicAiModelInfo {
	type: SupportingAi;
	model: string;
	apiKey: string;
}

// Specific AI model information interfaces
interface GptAiModelInfo extends BasicAiModelInfo {
	type: 'gpt';
	model: SupportingAiModel<'gpt'>;
}

interface ClaudeAiModelInfo extends BasicAiModelInfo {
	type: 'claude';
	model: SupportingAiModel<'claude'>;
}

interface ExaoneAiModelInfo extends BasicAiModelInfo {
	type: 'exaone';
	model: SupportingAiModel<'exaone'>;
}

// Bedrock AI model information
export interface BedrockAiModelInfo extends Partial<BasicAiModelInfo> {
	type: 'bedrock';
	region: string;
	accessKeyId: string;
	secretAccessKey: string;
	model: SupportingAiModel<'bedrock'>;
}

interface LocalAiModelInfo extends Partial<BasicAiModelInfo> {
	type: 'local';
	model: SupportingAiModel<'local'>;
}

// Combined AI model information type
export type AiModelInfo =
	| GptAiModelInfo
	| ClaudeAiModelInfo
	| ExaoneAiModelInfo
	| BedrockAiModelInfo
	| LocalAiModelInfo;
