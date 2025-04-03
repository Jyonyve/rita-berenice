import { useState, useEffect, useCallback } from 'react';
import { ChatMessage, ChatTurn, SUFFIX } from '@client/domain/chat';
import { useAiModel } from '@client/hook/useAiModel';
import { AiRole } from '../domain/aimodel/AiInfoTypes';
import {
	buildChatTurnToJsonString,
	convertMessageContentToString,
	extractValidOpenAiContent,
	isOpenAI,
	buildChatMessage,
	parseMessageId,
	buildMessageId,
} from '#root/src/shared/util/index';

const SUMMARY_INTERVAL = Number(import.meta.env.VITE_SUMMARY_INTERVAL) || 3;
const MAX_TURNS = Number(import.meta.env.VITE_QUERY_LIMIT) || 10;

export const useChat = () => {
	const [isLoading, setIsLoading] = useState(false);
	const [currentSessionId, setCurrentSessionId] = useState<string>('');
	const [recentChatTurn, setRecentChatTurn] = useState<ChatTurn[]>([]);
	const { aiModelInfo, llm, changeAiModel } = useAiModel();

	const openAI = isOpenAI(llm);

	const changeSessionId = useCallback((newSessionId: string) => {
		if (newSessionId) setCurrentSessionId(newSessionId);
	}, []);

	// Get the current sequence number based on the most recent chat turn
	const getCurrentSequence = useCallback((): number => {
		if (recentChatTurn.length === 0) return 0;
		return recentChatTurn[recentChatTurn.length - 1].sequence;
	}, [recentChatTurn]);

	// Get the next sequence number
	const getNextSequence = useCallback((): number => {
		return getCurrentSequence() + 1;
	}, [getCurrentSequence]);

	// Generate a summary for the conversation
	const generateSummary = useCallback(async (): Promise<string | undefined> => {
		if (!llm || recentChatTurn.length === 0) return;

		const currentSequence = getCurrentSequence();
		if (currentSequence % SUMMARY_INTERVAL !== 0) return;

		const summaryContent = `Summarize the following chat:\n${recentChatTurn
			.slice(-MAX_TURNS)
			.map((turn) => buildChatTurnToJsonString(turn))
			.join('\n\n')}`;

		try {
			if (openAI) {
				const completion = await llm.chat.completions.create({
					model: aiModelInfo.model,
					messages: [{ role: 'system', content: summaryContent }],
				});
				return extractValidOpenAiContent(completion);
			} else {
				const response = await llm.invoke([{ role: 'system', content: summaryContent }]);
				return convertMessageContentToString(response.content);
			}
		} catch (error) {
			console.error('Error generating summary:', error);
			return undefined;
		}
	}, [llm, recentChatTurn, getCurrentSequence, aiModelInfo.model, openAI]);

	// Get a response from the LLM
	const getResponseFromLlm = useCallback(
		async (prompt: string, userPickModel?: string): Promise<string> => {
			if (!llm) throw new Error('No LLM client available.');

			// Change AI model if user picks a different one
			if (userPickModel && userPickModel !== aiModelInfo.model) {
				setIsLoading(true);
				await changeAiModel(userPickModel);
				setIsLoading(false);
			}

			try {
				if (openAI) {
					const response = await llm.chat.completions.create({
						model: aiModelInfo.model,
						messages: [{ role: 'user', content: prompt }],
					});
					return extractValidOpenAiContent(response);
				} else {
					const response = await llm.invoke([{ role: 'user', content: prompt }]);
					return convertMessageContentToString(response.content);
				}
			} catch (error) {
				console.error('Error getting response from LLM:', error);
				return 'Sorry, I encountered an error while processing your request.';
			}
		},
		[llm, aiModelInfo.model, changeAiModel, openAI]
	);

	// Create a new chat turn
	const createChatTurn = useCallback(
		(userMessage: ChatMessage, assistantMessage: ChatMessage, isFixed: boolean = true): ChatTurn => {
			return {
				sessionId: currentSessionId,
				sequence: parseInt(parseMessageId(userMessage.messageId).sequence.toString()),
				request: userMessage,
				response: [assistantMessage],
				isFixed,
			};
		},
		[currentSessionId]
	);

	// Add a temporary response to the most recent chat turn
	const addTemporaryResponse = useCallback(
		(assistantMessage: ChatMessage): void => {
			if (recentChatTurn.length === 0) return;

			const currentTurn = recentChatTurn[recentChatTurn.length - 1];

			// Create a new turn with the additional response
			const updatedTurn: ChatTurn = {
				...currentTurn,
				response: [...currentTurn.response, assistantMessage],
				isFixed: false,
			};

			// Update the recent chat turns
			setRecentChatTurn([...recentChatTurn.slice(0, -1), updatedTurn]);
		},
		[recentChatTurn]
	);

	// Fix the current chat turn (mark as final)
	const fixCurrentChatTurn = useCallback(
		(responseIndex: number = 0): ChatTurn | null => {
			if (recentChatTurn.length === 0) return null;

			const currentTurn = recentChatTurn[recentChatTurn.length - 1];

			// If the selected response doesn't exist, do nothing
			if (responseIndex >= currentTurn.response.length) return null;

			// Create a new turn with only the selected response and marked as fixed
			const fixedTurn: ChatTurn = {
				...currentTurn,
				response: [currentTurn.response[responseIndex]],
				isFixed: true,
			};

			// Update the recent chat turns
			setRecentChatTurn([...recentChatTurn.slice(0, -1), fixedTurn]);

			return fixedTurn;
		},
		[recentChatTurn]
	);

	// Add a new chat turn to the conversation
	const addChatTurn = useCallback((chatTurn: ChatTurn): void => {
		setRecentChatTurn((prev) => [...prev, chatTurn]);
	}, []);

	// Load chat history from storage
	const loadChatHistory = useCallback(
		async (sessionId: string): Promise<void> => {
			// This would typically fetch from your storage/database
			// For now, just setting the session ID
			changeSessionId(sessionId);
		},
		[changeSessionId]
	);

	// Clear the chat history
	const clearChatHistory = useCallback((): void => {
		setRecentChatTurn([]);
	}, []);

	return {
		recentChatTurn,
		isLoading,
		currentSessionId,
		changeSessionId,
		createChatTurn,
		addTemporaryResponse,
		fixCurrentChatTurn,
		addChatTurn,
		getResponseFromLlm,
		generateSummary,
		getCurrentSequence,
		getNextSequence,
		loadChatHistory,
		clearChatHistory,
	};
};
