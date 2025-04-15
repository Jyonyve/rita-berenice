import { useState, useCallback } from 'react';
import { ChatTurn, TempChatTurn } from '@shared/index.ts';

export const useChatClient = () => {
	// State for fixed chat history
	const [chatTurns, setChatTurns] = useState<ChatTurn[]>([]);
	// State for the single, ongoing temporary turn
	const [tempChatTurn, setTempChatTurn] = useState<TempChatTurn>();

	const [isLoading, setIsLoading] = useState(false);
	const [isLoadingHistory, setIsLoadingHistory] = useState(false);
	const [error, setError] = useState<string>();
	const [hasMoreHistory, setHasMoreHistory] = useState(true);

	// Setters for initial data
	const setInitialData = useCallback((fixedTurns: ChatTurn[], tempTurn?: TempChatTurn) => {
		setChatTurns(fixedTurns);
		setTempChatTurn(tempTurn);
		setHasMoreHistory(fixedTurns.length > 0);
	}, []);

	// Add older fixed turns (prepend for infinite scroll)
	const addOlderChatTurns = useCallback((olderTurns: ChatTurn[]) => {
		if (olderTurns.length > 0) {
			setChatTurns((prev) => [...olderTurns, ...prev]);
		}
	}, []);

	// Add a new fixed turn (append)
	const addChatTurn = useCallback((turn: ChatTurn) => {
		setChatTurns((prev) => [...prev, turn]);
	}, []);

	// Set or clear the temp turn
	const changeTempChatTurn = useCallback((temp?: TempChatTurn) => {
		setTempChatTurn(temp);
	}, []);

	// Clear all state
	const clearChatState = useCallback(() => {
		setChatTurns([]);
		setTempChatTurn(undefined);
		setIsLoading(false);
		setIsLoadingHistory(false);
		setError(undefined);
		setHasMoreHistory(true);
	}, []);

	// Sequence helpers
	const getCurrentSequence = useCallback((): number => {
		if (chatTurns.length === 0) return -1;
		return chatTurns[chatTurns.length - 1].sequence;
	}, [chatTurns]);

	const getNextSequence = useCallback((): number => {
		const seq = getCurrentSequence();
		return seq === -1 ? 0 : seq + 1;
	}, [getCurrentSequence]);

	return {
		// State
		chatTurns,
		tempChatTurn,
		isLoading,
		isLoadingHistory,
		error,
		hasMoreHistory,

		// Setters
		setInitialData,
		addOlderChatTurns,
		addChatTurn,
		changeTempChatTurn,
		setIsLoading,
		setIsLoadingHistory,
		setError,
		setHasMoreHistory,
		clearChatState,

		// Getters
		getCurrentSequence,
		getNextSequence,
	};
};
