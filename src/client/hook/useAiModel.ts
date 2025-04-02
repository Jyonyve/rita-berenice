import { useState } from 'react';

import { ChatOpenAI } from '@langchain/openai';
// import { ChatBedrockConverse } from '@langchain/aws';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOllama } from '@langchain/ollama';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'; // Keep for direct/openrouter
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AiModelInfo, supportAiModelInfo } from '@client/domain/aimodel';
import { removeLocalPrefix } from '@client/util/chatConvertUtils';
import { useErrorDialog } from '@shared/useMuiComp';
import {
	determineDefaultSummaryAiInfo,
	determineInitialDefaultAiInfo,
	freeAiModelInfos,
	getAiModelInfo,
	isOpenAI,
	isValidAiModelInfo,
} from '@client/util/index';
import OpenAI from 'openai';
// import {
// 	initializeAwsCredentials,
// 	getAwsCredentials,
// 	isAwsCredentialsExpired,
// } from '@util/awsCredentialUtils';

const initialDefaultAiInfo = determineInitialDefaultAiInfo();
const initialDefaultSummaryAiInfo = determineDefaultSummaryAiInfo();

// Function to create LLM instance based on the new AiModelInfo structure
const createLlmInstance = (aiInfo: AiModelInfo): BaseChatModel | OpenAI => {
	const { platform, provider, model, apiKey } = aiInfo;

	switch (platform) {
		case 'direct':
			switch (provider) {
				case 'openai':
					return new ChatOpenAI({ model, apiKey });
				case 'anthropic':
					return new ChatAnthropic({ model, apiKey });
				case 'google':
					return new ChatGoogleGenerativeAI({ model, apiKey });
				default:
					console.warn(`Unsupported direct provider: ${provider}. Falling back.`);
					// Fallback to a default local model might be safer here
					return new ChatOllama({ ...initialDefaultSummaryAiInfo });
			}
		case 'openrouter':
			return new OpenAI({
				baseURL: 'https://openrouter.ai/api/v1',
				apiKey: '<OPENROUTER_API_KEY>',
				defaultHeaders: {
					'HTTP-Referer': '<YOUR_SITE_URL>', // Optional. Site URL for rankings on openrouter.ai.
					'X-Title': 'Rita Berenice', // Optional. Site title for rankings on openrouter.ai.
				},
			});
		// case 'bedrock':
		//   // Requires AWS credentials setup, which is commented out.
		//   // return new ChatBedrockConverse({ model }); // Simplified example
		//   console.warn('Bedrock source selected but integration is commented out. Falling back.');
		//   return new ChatOllama({ model: removeLocalPrefix(supportingAiInfo.local.ollama[0]) });
		case 'local':
			return new ChatOllama({ model });
		default:
			console.warn(`Unsupported AI source: ${platform}. Falling back to default free model.`);
			return new ChatOllama({ ...initialDefaultSummaryAiInfo });
	}
};

export const useAiModel = () => {
	// Initialize LLM instances
	const initialLlm = createLlmInstance(initialDefaultAiInfo);
	const initialSummaryLlm = createLlmInstance(initialDefaultSummaryAiInfo);

	// state
	const [aiModelInfo, setAiModelInfo] = useState<AiModelInfo>(initialDefaultAiInfo); // Renamed setter for clarity
	const [llm, setLlm] = useState<BaseChatModel | OpenAI>(initialLlm);
	const [summaryLlm, setSummaryLlm] = useState<BaseChatModel | OpenAI>(initialSummaryLlm);

	// hook
	const { showError } = useErrorDialog();

	const changeAiModel = async (modelName: string) => {
		const newAiInfo = getAiModelInfo(modelName);
		if (!newAiInfo || !isValidAiModelInfo(newAiInfo)) {
			showError(`Invalid AI model information for: ${modelName}`);
			return;
		}

		setAiModelInfo(newAiInfo);
		await changeLLMClient(newAiInfo);
	};

	const changeLLMClient = async (newAiInfo: AiModelInfo) => {
		const summaryAiInfo = determineDefaultSummaryAiInfo();

		const newLlm = createLlmInstance(newAiInfo);
		const newSummaryLlm = createLlmInstance(summaryAiInfo);

		setLlm(newLlm);
		setSummaryLlm(newSummaryLlm);
	};

	// AWS credential refresh logic and useEffect are removed

	// const refreshAwsCredentials = async () => {
	// 	try {
	// 		// if (isAwsCredentialsExpired()) { // Assuming isAwsCredentialsExpired is defined elsewhere
	// 		// 	await initializeAwsCredentials(); // Assuming initializeAwsCredentials is defined elsewhere
	// 		// }
	// 		// const credentials = await getAwsCredentials(); // Assuming getAwsCredentials is defined elsewhere

	// 		// // 크레덴셜 만료 5분 전에 자동 갱신 설정
	// 		// if (credentials.Expiration) {
	// 		// 	const expiresInMs = new Date(credentials.Expiration).getTime() - Date.now() - 5 * 60 * 1000;
	// 		// 	refreshTimeout = setTimeout(refreshAwsCredentials, Math.max(expiresInMs, 0));
	// 		// }
	// 	} catch (error) {
	// 		console.error('AWS credentials refresh failed:', error);
	// 	}
	// };

	// useEffect(() => {
	// 	// if (aiModelInfo.type === 'bedrock') {
	// 	// 	refreshAwsCredentials(); // Bedrock 사용 시 인증 실행
	// 	// } else {
	// 	// 	if (refreshTimeout) {
	// 	//          clearTimeout(refreshTimeout);
	// 	//          refreshTimeout = null;
	// 	//       }
	// 	// }
	// 	// // Cleanup function to clear timeout on component unmount or when aiModelInfo.type changes
	// 	// return () => {
	// 	//    if (refreshTimeout) {
	// 	//       clearTimeout(refreshTimeout);
	// 	//    }
	// 	// };
	// }, [aiModelInfo.type]); // Dependency array includes aiModelInfo.type

	return { aiModelInfo, llm, summaryLlm, changeAiModel };
};
