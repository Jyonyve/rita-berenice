import { ChatOpenAI } from '@langchain/openai';
import { BedrockChat } from '@langchain/community/chat_models/bedrock';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOllama } from '@langchain/ollama';
import { AiModelInfo, BedrockAiModelInfo } from '@domain/aimodel';
import { useErrorDialog } from 'shared/useDialog';
import { useEffect, useState } from 'react';
import {
	defaultAiInfo,
	getDefaultSummaryAiInfo,
	getAiModelInfo,
	isValidAiModelInfo,
} from '@util/aiTypeModelUtils';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

export const useAiModel = () => {
	// state
	const [aiInfo, setAiInfo] = useState<AiModelInfo>();
	const [llm, setLlm] = useState<BaseChatModel>();
	const [summaryLlm, setSummaryLlm] = useState<BaseChatModel>();

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

	// Effect to change LLM client only if type changes
	useEffect(() => {
		if (aiInfo) {
			if (llm && llm._modelType() !== aiInfo.model) {
				changeLLMClient(aiInfo);
			}
		}
	}, [aiInfo, llm]);

	return { llm, summaryLlm, aiInfo, changeAiModel };
};
