import { useState, useEffect, useCallback } from 'react';
import { ChatEntry, ChatSession, ChatMessage, ChatTurn } from '@domain/chat';
import { useAiModel } from '@hook/useAiModel';
import { buildChatTurnToText, parseTextToEntries } from '@util/parseUtils';
import { MessageContent, MessageContentText } from '@langchain/core/messages';
import axios from 'axios';
import { AiRole } from '@domain/aimodel';

const SUMMARY_INTERVAL = import.meta.env.VITE_SUMMARY_INTERVAL;
const MAX_TURNS = import.meta.env.VITE_QUERY_LIMIT;

export const useChat = () => {
	const [isLoading, setIsLoading] = useState(false);
	const [currentSessionId, setCurrentSessionId] = useState<string>();
	const [recentChatTurn, setRecentChatTurn] = useState<ChatTurn[]>([]);
	const { aiInfo, llm, changeAiModel } = useAiModel();

	const changeSessionId = (newSessionId: string) => {
		if (newSessionId) setCurrentSessionId(newSessionId);
	};

	const saveChatTurn = async (chatTurn: ChatTurn) => {
		// TODO: do ChromaService stuff here
		// await chromaService.storeChatTurn(chatTurn);
		if (chatTurn.sequence % SUMMARY_INTERVAL === 0) {
			await updateSummary(chatTurn.sessionId);
		}
	};

	const updateSummary = async (sessionId: string) => {
		if (!llm) throw new Error('No LLM client available.');
		// TODO: do ChromaService stuff here
		const summary = await llm.invoke([
			{
				role: 'system',
				content: `Summarize the following chat: ${recentChatTurn
					.map((turn) => buildChatTurnToText(turn))
					.join('\n\n')}`,
			},
		]);
		// await chromaService.storeSummary(sessionId, summary.content);
	};

	const buildChatMessage = (speaker: AiRole, text: string): ChatMessage => {
		const entries: ChatEntry[] = parseTextToEntries(text);
		return {
			messageId: `${currentSessionId}_${Date.now()}`,
			speaker,
			entries,
			timestamp: new Date().toISOString(),
		};
	};

	const buildUserPromptFromLog = async (
		userText: string,
		isFull: boolean = false
	): Promise<string> => {
		// TODO: do ChromaService stuff here

		if (!currentSessionId) throw new Error('No active session.');
		const relevantDetail = '';
		// 요약 조회
		// let relevantDetail = (await chromaService.querySummary(currentSessionId, userText)) || '';

		// 요약이 충분하지 않다면 전체 로그 검색 수행
		if (!relevantDetail || isFull) {
			// relevantDetail = (await chromaService.queryChatLog(currentSessionId, userText)) || '';
		}

		// 프롬프트 조합
		return `Context:\n
            Relevant Detail: ${relevantDetail}\n
            User Prompt: ${userText}`;
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
			.map((turn) => buildChatTurnToText(turn));

		const response = await llm.invoke([...conversationHistory, { role: 'user', content: prompt }]);

		if (typeof response.content === 'string') {
			return response.content;
		} else if (Array.isArray(response.content)) {
			const textContent = response.content.find(
				(content) => content.type === 'text'
			) as MessageContentText;
			return textContent ? textContent.text : JSON.stringify(response.content);
		} else {
			return JSON.stringify(response.content);
		}
	};

	const getLlmResponse = async (userText: string): Promise<string> => {
		if (!currentSessionId) throw new Error('No active session.');

		const userMsg = buildChatMessage('user', userText);
		const prompt = await buildUserPromptFromLog(userText);
		const response = await getResponseFromLlm(prompt);
		const assistantMsg = buildChatMessage('assistant', response);

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
		await saveChatTurn(newTurn);

		return response;
	};

	return { recentChatTurn, isLoading, currentSessionId, changeSessionId, getLlmResponse };
};
