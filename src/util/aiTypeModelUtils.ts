import AWS from 'aws-sdk';
import { AiModelInfo, SupportingAi } from '@domain/aimodel';
import { AwsCredentialIdentity } from '@aws-sdk/types';

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

// credentials for the supporting AI models
export const supportingAiApiKey: Record<string, string> = {
	gpt: import.meta.env.VITE_OPENAI_API_KEY || '',
	claude: import.meta.env.VITE_ANTHROPIC_API_KEY || '',
	exaone: import.meta.env.VITE_EXAONE_API_KEY || '',
} as const;

export const getBedrockCredentials = async (): Promise<AwsCredentialIdentity> => {
	return new Promise<AWS.Credentials>((resolve, reject) => {
		AWS.config.getCredentials((err) => {
			if (err) reject(err);
			else resolve(AWS.config.credentials as AWS.Credentials);
		});
	});
};

export const SupportingAiList = Object.keys(supportingAiInfo).flat();
export const SupportingAiModelList = Object.values(supportingAiInfo).flat();
export const defaultAiInfo: AiModelInfo = {
	type: 'local',
	model: 'local_exaone-deep-2.4b',
} as const;

export const isValidAiModelInfo = (aiInfo: any): aiInfo is AiModelInfo => {
	if (!aiInfo || typeof aiInfo !== 'object') {
		return false;
	}
	if (!getAiModelInfo(aiInfo.model)) {
		return false;
	}
	return true;
};

// Utility function to get aiInfo from model
export const getAiModelInfo = async (model: string): Promise<AiModelInfo | undefined> => {
	for (const type in supportingAiInfo) {
		if (supportingAiInfo[type as SupportingAi].includes(model)) {
			switch (type) {
				case 'gpt':
					return { type, model, apiKey: supportingAiApiKey.gpt };
				case 'claude':
					return { type, model, apiKey: supportingAiApiKey.claude };
				case 'bedrock':
					const credentials = await getBedrockCredentials();
					return {
						...credentials,
						type,
						model,
						region: import.meta.env.AWS_BEDROCK_AWS_REGION || 'us-east-1',
					};
				case 'exaone':
					return { type, model, apiKey: supportingAiApiKey.exaone };
				case 'local':
					return { type, model };
				default:
					return defaultAiInfo;
			}
		}
	}
	return undefined;
};

export const getDefaultSummaryAiInfo = async (type: SupportingAi) =>
	type === 'local' ? defaultAiInfo : await getAiModelInfo(supportingAiInfo.bedrock[0]);
