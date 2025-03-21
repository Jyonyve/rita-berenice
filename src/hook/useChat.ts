import { useState, useEffect, useCallback } from 'react';
import { ChatEntry, ChatSession, ChatMessage, ChatTurn } from '@domain/chat';
import { useAiModel } from '@hook/useAiModel';
import { parseTextToEntries } from '@util/parseUtils';
import { MessageContent } from '@langchain/core/messages';
import axios from 'axios';
import { DefaultAiRole } from '@domain/aimodel';

const SUMMARY_INTERVAL = 3;

export const useChat = () => {
	const [isLoading, setIsLoading] = useState(false);
	const [currentSessionId, setCurrentSessionId] = useState<string>();
	const [recentChatTurn, setRecentChatTurn] = useState<ChatTurn[]>([]);
	const { aiInfo, llm, changeAiModel } = useAiModel();

	const changeSessionId = (newSessionId: string) => {
		if (newSessionId) setCurrentSessionId(newSessionId);
	};

	const saveChatTurn = async (chatTurn: ChatTurn) => {
		// await chromaService.storeChatTurn(chatTurn);
		if (chatTurn.sequence % SUMMARY_INTERVAL === 0) {
			await updateSummary(chatTurn.sessionId);
		}
	};

	const updateSummary = async (sessionId: string) => {
		if (!llm) throw new Error('No LLM client available.');
		const summary = await llm.invoke([
			{
				role: 'system',
				content: `Summarize the following chat:
${recentChatTurn.map((turn) => turn.request.entries.map((e) => e.prompt).join(' ')).join('\n')}`,
			},
		]);
		// await chromaService.storeSummary(sessionId, summary.content);
	};

	const buildChatMessage = (speaker: DefaultAiRole, text: string): ChatMessage => {
		const entries: ChatEntry[] = parseTextToEntries(text);
		return {
			messageId: `${currentSessionId}_${Date.now()}`,
			speaker,
			entries,
			timestamp: new Date().toISOString(),
		};
	};

	const buildPromptWithMemory = async (query: string): Promise<string> => {
		if (!currentSessionId) throw new Error('No active session.');

		let summaryPrompt = '';
		try {
			// summaryPrompt = await chromaService.getSummary(currentSessionId);
		} catch (error) {
			console.warn('No summary available, checking full logs.');
		}

		const fullLogResults = '';
		// await chromaService.queryChatLog(currentSessionId, query);
		return `Summary:
${summaryPrompt}\n\nFull Chat Context:
${fullLogResults}\n\nUser: ${query}`;
	};

	// const callLlmForSession = async (
	// 	sessionId: string,
	// 	userInput: string,
	// 	model?: string
	// ): Promise<MessageContent> => {
	// 	if (model && model !== aiInfo.model) {
	// 	changeAiModelAiModel(model);
	// 	}

	// 	const conversationHistory = recentChatTurn.map((turn) => ({
	// 		role: turn.speaker === 'user' ? 'user' : 'assistant',
	// 		content: turn.request.entries.map((entry) => entry.prompt).join(' '),
	// 	}));

	// 	if (aiInfo.type === 'local') {
	// 		const response = await axios.post('http://localhost:11434/api/generate', {
	// 			model: aiInfo.model,
	// 			messages: [...conversationHistory, { role: 'user', content: userInput }],
	// 		});
	// 		return response.data.response;
	// 	}

	// 	return llm.invoke([...conversationHistory, { role: 'user', content: userInput }]);
	// };

	// const chat = async (userMessage: string): Promise<string> => {
	// 	if (!currentSessionId) throw new Error('No active session.');

	// 	const userMsg = buildChatMessage('user', userMessage);
	// 	const prompt = await buildPromptWithMemory(userMessage);
	// 	const response = await callLlmForSession(currentSessionId, prompt);
	// 	const assistantMsg = buildChatMessage('assistant', response.content);

	// 	const sequence = recentChatTurn.length
	// 		? recentChatTurn[recentChatTurn.length - 1].sequence + 1
	// 		: 1;
	// 	const newTurn: ChatTurn = {
	// 		sessionId: currentSessionId,
	// 		sequence,
	// 		request: userMsg,
	// 		response: assistantMsg,
	// 		isTemp: true,
	// 	};
	// 	setRecentChatTurn([...recentChatTurn, newTurn]);
	// 	await saveChatTurn(newTurn);

	// 	return response.content;
	// };

	return { messages: recentChatTurn, isLoading, currentSessionId, changeSessionId };
};
