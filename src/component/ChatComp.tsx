import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { ChatSession, ChatMessage, ChatEntry } from '@domain/chat';
import { chromaService } from './ChromaComp';
import { parseTextToEntries } from '@util/parseUtils';
import { useAiModel } from '@hook/useAiModel';
import { MessageContent } from '@langchain/core/messages';
import { useCallback } from 'react';

const DEFAULT_QUERY_LIMIT = import.meta.env.VITE_QUERY_LIMIT;
const SUMMARY_INTERVAL = import.meta.env.VITE_SUMMARY_INTERVAL;

export const chatMemoryService = () => {
	//
	const { llm, aiInfo, changeAiModel: putAiModel } = useAiModel();

	const callLlmApi = useCallback(
		async (prompt: string) => {
			if (!aiInfo || !llm) throw new Error('No AI model information available.');

			const messages = [
				{
					role: 'assistant',
					content: `You are a helpful assistant with memory of past conversations.`,
				},
				{ role: 'user', content: prompt },
			];

			if (aiInfo.type === 'local') {
				const localResponse = await llm.invoke(messages);
				return localResponse.content;
			}

			switch (
				llm._llmType()
				// Handle HTTP API call for other models
				// const completion = await llm.chat.completions.create({ model: aiInfo.model, messages });
				// return completion.choices[0].message.content;
			) {
			}
		},
		[aiInfo, llm]
	);

	return <> </>;
};
