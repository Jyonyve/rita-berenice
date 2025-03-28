import { AiModelInfo, defaultAiInfo, SupportingAi, supportingAiInfo } from '@domain/aimodel';
// import { getAwsCredentials, isAwsCredentialsExpired } from '@util/awsCredentialUtils'; // Import from awsCredentialUtils

// API keys for each AI service
export const supportingAiApiKey: Record<string, string> = {
	gpt: import.meta.env.VITE_OPENAI_API_KEY || '',
	claude: import.meta.env.VITE_ANTHROPIC_API_KEY || '',
	exaone: import.meta.env.VITE_EXAONE_API_KEY || '',
} as const;

export const isValidAiModelInfo = (aiInfo: any): aiInfo is AiModelInfo => {
	if (!aiInfo || typeof aiInfo !== 'object') return false;
	if (!getAiModelInfo(aiInfo.model)) return false;
	return true;
};

// 🔹 Get AI Model Info (updated for AWS Bedrock)
export const getAiModelInfo = async (model: string): Promise<AiModelInfo | undefined> => {
	for (const type in supportingAiInfo) {
		if (supportingAiInfo[type as SupportingAi].includes(model)) {
			switch (type) {
				case 'gpt':
					return { type, model, apiKey: supportingAiApiKey.gpt };
				case 'claude':
					return { type, model, apiKey: supportingAiApiKey.claude };
				case 'bedrock':
					return { type, model };
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

// 🔹 Get Default Summary AI Info
export const getDefaultSummaryAiInfo = async (type: SupportingAi) =>
	type === 'local' ? defaultAiInfo : await getAiModelInfo(supportingAiInfo.bedrock[0]);
