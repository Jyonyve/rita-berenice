import { ChatOpenAI } from '@langchain/openai';
import { BedrockChat } from '@langchain/community/chat_models/bedrock';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOllama } from '@langchain/ollama';
import { AiModelInfo } from '@domain/aimodel';
import { useErrorDialog } from 'shared/useDialog';
import { useState } from 'react';
import {
	defaultAiInfo,
	getDefaultSummaryAiInfo,
	getAiModelInfo,
	isValidAiModelInfo,
	supportingAiInfo,
} from '@util/aiTypeModelUtils';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { removeLocalPrefix } from '@util/parseUtils';

export const useAiModel = () => {
	//	const
	const defaultLlm = new ChatOllama({ model: removeLocalPrefix(supportingAiInfo.local[0]) });
	const defaultSummaryLlm = new ChatOllama({ model: removeLocalPrefix(supportingAiInfo.local[0]) });

	// state
	const [aiInfo, setAiInfo] = useState<AiModelInfo>(defaultAiInfo);
	const [llm, setLlm] = useState<BaseChatModel>(defaultLlm);
	const [summaryLlm, setSummaryLlm] = useState<BaseChatModel>(defaultSummaryLlm);

	// hook
	const { showError } = useErrorDialog();

	// function
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
		// change the LLM client based on the AI model
		const summaryAiInfo = await getDefaultSummaryAiInfo(aiInfo.type);
		let newLlm;
		let newSummaryLlm: BaseChatModel = new BedrockChat({ ...summaryAiInfo });
		switch (aiInfo.type) {
			case 'gpt':
				newLlm = new ChatOpenAI({ ...aiInfo });
				break;
			case 'claude':
				newLlm = new ChatAnthropic({ ...aiInfo });
				break;
			case 'bedrock':
				newLlm = new BedrockChat({ ...aiInfo });
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

	return { aiInfo, llm, summaryLlm, changeAiModel };
};
