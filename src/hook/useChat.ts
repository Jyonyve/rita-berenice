import { useState, useEffect, useCallback } from 'react';
import { ChatEntry, ChatSession, ChatMessage, ChatTurn } from '@domain/chat';
import { useAiModel } from '@hook/useAiModel';
import {
	buildChatTurnToJsonString,
	convertMessageContentToString,
	parseTextToEntries,
} from '@util/chatConvertUtils';
import { MessageContent, MessageContentText } from '@langchain/core/messages';
import axios from 'axios';
import { AiRole } from '@domain/aimodel';
import { Collection } from 'chromadb';

const SUMMARY_INTERVAL = import.meta.env.VITE_SUMMARY_INTERVAL;
const MAX_TURNS = import.meta.env.VITE_QUERY_LIMIT;

export const useChat = () => {
	//
	const [isLoading, setIsLoading] = useState(false);
	const [currentSessionId, setCurrentSessionId] = useState<string>('');
	const [recentChatTurn, setRecentChatTurn] = useState<ChatTurn[]>([]);
	const { aiModelInfo: aiInfo, llm, changeAiModel } = useAiModel();

	const changeSessionId = (newSessionId: string) => {
		if (newSessionId) setCurrentSessionId(newSessionId);
	};

	const saveChatTurn = async (chatTurn: ChatTurn) => {
		if (!llm) throw new Error('No LLM client available.');

		if (chatTurn.sequence % SUMMARY_INTERVAL === 0) {
			const summary = await llm.invoke([
				{
					role: 'system',
					content: `Summarize the following chat: ${recentChatTurn
						.map((turn) => buildChatTurnToJsonString(turn))
						.join('\n\n')}`,
				},
			]);

			return summary.content;
		}
	};

	const getResponseFromLlm = async (prompt: string, userPickModel?: string): Promise<string> => {
		// Change AI model if user picks a different one
		if (userPickModel && userPickModel !== aiInfo.model) {
			setIsLoading(true);
			await changeAiModel(userPickModel);
			setIsLoading(false);
		}

		const conversationHistory = recentChatTurn
			.slice(-MAX_TURNS)
			.map((turn) => buildChatTurnToJsonString(turn));

		const response = await llm.invoke([...conversationHistory, { role: 'user', content: prompt }]);

		return convertMessageContentToString(response.content);
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
