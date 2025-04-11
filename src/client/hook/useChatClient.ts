import { useState, useCallback } from 'react';
import { ChatMessage, ChatTurn, parseMessageId } from '@shared/index.ts';

export const useChatClient = () => {
	const [isLoading, setIsLoading] = useState(false);
	const [currentSessionId, setCurrentSessionId] = useState<string>('');
	const [recentChatTurn, setRecentChatTurn] = useState<ChatTurn[]>([]);

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
		getCurrentSequence,
		getNextSequence,
		loadChatHistory,
		clearChatHistory,
	};
};
