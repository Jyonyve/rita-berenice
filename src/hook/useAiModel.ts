import { ChatOpenAI } from '@langchain/openai';
// import { ChatBedrockConverse } from '@langchain/aws';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOllama } from '@langchain/ollama';
import { AiModelInfo, defaultAiInfo, supportingAiInfo } from '@domain/aimodel';
import { useErrorDialog } from '@shared/useMuiComp';
import { useEffect, useState } from 'react';
import { getDefaultSummaryAiInfo, getAiModelInfo, isValidAiModelInfo } from '@util/aiModelUtils';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { removeLocalPrefix } from '@util/chatConvertUtils';
// import {
// 	initializeAwsCredentials,
// 	getAwsCredentials,
// 	isAwsCredentialsExpired,
// } from '@util/awsCredentialUtils';

export const useAiModel = () => {
	const defaultLlm = new ChatOllama({ model: removeLocalPrefix(supportingAiInfo.local[0]) });
	const defaultSummaryLlm = new ChatOllama({ model: removeLocalPrefix(supportingAiInfo.local[0]) });

	let refreshTimeout: NodeJS.Timeout | null = null;

	// state
	const [aiModelInfo, setAiInfo] = useState<AiModelInfo>(defaultAiInfo);
	const [llm, setLlm] = useState<BaseChatModel>(defaultLlm);
	const [summaryLlm, setSummaryLlm] = useState<BaseChatModel>(defaultSummaryLlm);

	// hook
	const { showError } = useErrorDialog();

	const changeAiModel = async (model: string) => {
		const newAiInfo = await getAiModelInfo(model);
		if (!newAiInfo || !isValidAiModelInfo(newAiInfo)) {
			showError('Invalid AI model information');
			return;
		}

		setAiInfo(newAiInfo);
		await changeLLMClient(newAiInfo); // Ensure LLM client is changed before proceeding
	};

	const changeLLMClient = async (aiInfo: AiModelInfo) => {
		const summaryAiInfo = await getDefaultSummaryAiInfo(aiInfo.type);
		let newLlm;
		let newSummaryLlm: BaseChatModel = new ChatBedrockConverse({ ...summaryAiInfo });
		switch (aiInfo.type) {
			case 'gpt':
				newLlm = new ChatOpenAI({ ...aiInfo });
				break;
			case 'claude':
				newLlm = new ChatAnthropic({ ...aiInfo });
				break;
			case 'bedrock':
				newLlm = new ChatBedrockConverse({ ...aiInfo });
				break;
			case 'exaone':
				newLlm = new ChatOllama({ ...aiInfo });
				break;
			case 'local':
				newLlm = new ChatOllama({ ...aiInfo });
				newSummaryLlm = new ChatOllama({ ...summaryAiInfo });
				break;
			default:
				throw new Error('Invalid AI model type');
		}
		setLlm(newLlm);
		setSummaryLlm(newSummaryLlm);
	};

	const refreshAwsCredentials = async () => {
		try {
			if (isAwsCredentialsExpired()) {
				await initializeAwsCredentials();
			}
			const credentials = await getAwsCredentials();

			// 크레덴셜 만료 5분 전에 자동 갱신 설정
			if (credentials.Expiration) {
				const expiresInMs = new Date(credentials.Expiration).getTime() - Date.now() - 5 * 60 * 1000;
				refreshTimeout = setTimeout(refreshAwsCredentials, Math.max(expiresInMs, 0));
			}
		} catch (error) {
			console.error('AWS credentials refresh failed:', error);
		}
	};

	useEffect(() => {
		if (aiModelInfo.type === 'bedrock') {
			refreshAwsCredentials(); // Bedrock 사용 시 인증 실행
		} else {
			clearTimeout(refreshTimeout!);
			refreshTimeout = null;
		}
	}, [aiModelInfo.type]);

	return { aiModelInfo, llm, summaryLlm, changeAiModel };
};
