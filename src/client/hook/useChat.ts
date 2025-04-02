import { useState, useEffect, useCallback } from 'react';
import { ChatMessage, ChatTurn, CHAT_ROLES } from '@client/domain/chat';
import { useAiModel } from '@client/hook/useAiModel';
import {
	buildChatTurnToJsonString,
	convertMessageContentToString,
	extractValidOpenAiContent,
	isOpenAI,
} from '@client/util/index';

const SUMMARY_INTERVAL = import.meta.env.VITE_SUMMARY_INTERVAL;
const MAX_TURNS = import.meta.env.VITE_QUERY_LIMIT;

export const useChat = () => {
	//
	const [isLoading, setIsLoading] = useState(false);
	const [currentSessionId, setCurrentSessionId] = useState<string>('');
	const [recentChatTurn, setRecentChatTurn] = useState<ChatTurn[]>([]);
	const { aiModelInfo, llm, changeAiModel } = useAiModel();

	const openAI = isOpenAI(llm);

	const changeSessionId = (newSessionId: string) => {
		if (newSessionId) setCurrentSessionId(newSessionId);
	};

	const saveChatTurn = async (chatTurn: ChatTurn) => {
		if (!llm) throw new Error('No LLM client available.');

		if (chatTurn.sequence % SUMMARY_INTERVAL === 0) {
			const summaryRequest = {
				role: CHAT_ROLES.SYSTEM,
				content: `Summarize the following chat:\n${recentChatTurn
					.map((turn) => buildChatTurnToJsonString(turn))
					.join('\n\n')}`,
			};

			if (openAI) {
				const completion = await llm.chat.completions.create({
					model: aiModelInfo.model,
					messages: [summaryRequest],
				});
				return extractValidOpenAiContent(completion);
			} else {
				const response = await llm.invoke([summaryRequest]);
				return convertMessageContentToString(response.content);
			}
		}
	};

	const getResponseFromLlm = async (prompt: string, userPickModel?: string): Promise<string> => {
		// Change AI model if user picks a different one
		if (userPickModel && userPickModel !== aiModelInfo.model) {
			setIsLoading(true);
			await changeAiModel(userPickModel);
			setIsLoading(false);
		}

		// const conversationHistory = recentChatTurn
		// 	.slice(-MAX_TURNS)
		// 	.map((turn) => buildChatTurnToJsonString(turn));

		if (openAI) {
			const response = await llm.chat.completions.create({
				model: aiModelInfo.model,
				messages: [{ role: CHAT_ROLES.USER, content: prompt }],
			});
			return extractValidOpenAiContent(response);
		} else {
			const response = await llm.invoke([{ role: CHAT_ROLES.USER, content: prompt }]);
			return convertMessageContentToString(response.content);
		}
	};

	const buildNextSequence = (userMsg: ChatMessage, assistantMsg: ChatMessage) => {
		const sequence = recentChatTurn.length
			? recentChatTurn[recentChatTurn.length - 1].sequence + 1
			: 1;
		const newTurn: ChatTurn = {
			sessionId: currentSessionId,
			sequence,
			request: userMsg,
			response: assistantMsg,
			isTemp: true,
		};
		setRecentChatTurn([...recentChatTurn, newTurn]);
	};

	return {
		recentChatTurn,
		isLoading,
		currentSessionId,
		changeSessionId,
		buildNextSequence,
		getResponseFromLlm,
		saveChatTurn,
	};
};
