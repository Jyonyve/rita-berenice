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

// Current AI models supported by the application
export const supportingAiInfo: Record<string, string[]> = {
	local: ['local_exaone-deep-2.4b'],
	gpt: ['gpt-4o', 'gpt-4o-mini'],
	claude: ['claude-3.7-sonnet', 'claude-3.5-haiku'],
	exaone: ['exaone-deep-7.8b', 'exaone-deep-2.4b'],
	bedrock: [
		'anthropic.claude-3-5-haiku-20241022-v1:0', // first one should be the default summary AI
		'anthropic.claude-3-7-sonnet-20250219-v1:0',
		'amazon.nova-pro-v1:0',
	],
} as const;
export const SupportingAiList = Object.keys(supportingAiInfo).flat();
export const SupportingAiModelList = Object.values(supportingAiInfo).flat();
export const defaultAiInfo: AiModelInfo = {
	type: 'local',
	model: 'local_exaone-deep-2.4b',
} as const;
