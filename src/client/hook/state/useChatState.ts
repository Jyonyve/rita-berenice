// src/hook/useChatState.ts
import { useState, useCallback, useEffect } from 'react';
import {
	ChatTurn,
	TempChatTurn,
	DEFAULT_LOADING_BATCH_TURN_COUNT,
	ChatResponse,
} from '@shared/index.ts';
import { getCachedMessages, saveMessagesToCache, loadAllCachedMessages } from '../../util/index.ts';

export const useChatState = (sessionId: string) => {
	const [chatTurns, setChatTurns] = useState<ChatTurn[]>([]); // Sorted: oldest at index 0, newest at end
	const [isLoadingHistory, setIsLoadingHistory] = useState(false); // Renamed to avoid confusion with API loading
	const [hasMoreHistory, setHasMoreHistory] = useState(true); // Renamed
	const [clientError, setClientError] = useState<string>();
	const [tempChatTurn, setTempChatTurn] = useState<TempChatTurn>();

	const _sortTurns = useCallback(
		(turns: ChatTurn[]) => turns.sort((a, b) => a.sequence - b.sequence),
		[]
	);

	// Function to load older messages from IndexedDB
	const loadOlderMessages = useCallback(
		async (batchSize: number = DEFAULT_LOADING_BATCH_TURN_COUNT) => {
			if (isLoadingHistory || !hasMoreHistory) {
				if (!hasMoreHistory) console.log('No more older messages to load from IDB.');
				return;
			}

			setIsLoadingHistory(true);
			setClientError(undefined);
			try {
				// Sequence of the oldest message currently in state (start of the array)
				const oldestLoadedSequence = chatTurns.length > 0 ? chatTurns[0].sequence : Infinity;

				const cachedOlder = await getCachedMessages(oldestLoadedSequence, batchSize);

				if (cachedOlder.length > 0) {
					const sortedCachedOlder = _sortTurns(cachedOlder);
					setChatTurns((prev) => [...sortedCachedOlder, ...prev]);
					setHasMoreHistory(cachedOlder.length === batchSize);
				} else {
					setHasMoreHistory(false); // No more turns in IDB for this range
				}
			} catch (err: any) {
				console.error('Load Older Messages from IDB Error:', err);
				setClientError('Failed to load older messages from cache.');
				setHasMoreHistory(false);
			} finally {
				setIsLoadingHistory(false);
			}
		},
		[sessionId, isLoadingHistory, hasMoreHistory, chatTurns, _sortTurns]
	);

	// Add a new fixed turn (appended at the end - newest)
	const addChatTurn = useCallback(
		async (turn: ChatTurn) => {
			setChatTurns((prev) => _sortTurns([...prev, turn]));
			await saveMessagesToCache([turn]); // Save the new turn to IDB
		},
		[_sortTurns]
	);

	const addChatTurns = useCallback(
		async (newTurns: ChatTurn[]) => {
			if (newTurns.length === 0) return;

			setChatTurns((prevTurns) => {
				const existingSequenceMap = new Map(prevTurns.map((t) => [t.sequence, t]));
				const uniqueNewTurns = newTurns.filter((nt) => !existingSequenceMap.has(nt.sequence));
				return _sortTurns([...prevTurns, ...uniqueNewTurns]);
			});
			await saveMessagesToCache(newTurns); // Save to IDB
		},
		[_sortTurns]
	);

	const changeTempChatTurn = useCallback((temp?: TempChatTurn) => {
		setTempChatTurn(temp);
	}, []);

	const clearChatState = useCallback(() => {
		setChatTurns([]);
		setTempChatTurn(undefined); // [FIX] Recommended to uncomment this for a full reset.
		setIsLoadingHistory(false);
		setClientError(undefined);
		setHasMoreHistory(true);
	}, []);

	const getCurrentSequence = useCallback((): number => {
		if (chatTurns.length === 0) return -1;
		return chatTurns[chatTurns.length - 1].sequence; // Last item is newest
	}, [chatTurns]);

	const getNextSequence = useCallback((): number => {
		const seq = getCurrentSequence();
		return seq === -1 ? 0 : seq + 1;
	}, [getCurrentSequence]);

	// Initial load strategy from IDB or server
	useEffect(() => {
		const loadInitialView = async () => {
			if (!sessionId) return;
			setIsLoadingHistory(true);
			const initialTurns = await getCachedMessages(Infinity, DEFAULT_LOADING_BATCH_TURN_COUNT);
			setChatTurns(_sortTurns(initialTurns));
			setHasMoreHistory(true);
			setIsLoadingHistory(false);
		};
		loadInitialView();
	}, [sessionId, _sortTurns]);

	return {
		chatTurns,
		tempChatTurn,
		isLoadingHistory, // Keep alias for existing usage
		clientError,
		hasMoreHistory, // Keep alias

		loadOlderMessages, // Expose for InfiniteScroll
		addChatTurn, // Renamed from addChatTurnIndexedDB for simplicity
		addChatTurns, // Renamed
		changeTempChatTurn,
		setIsLoadingHistory,
		setClientError,
		setHasMoreHistory,
		clearChatState,
		getCurrentSequence,
		getNextSequence,
	};
};
