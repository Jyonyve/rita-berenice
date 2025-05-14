// src/hook/useChatState.ts
import { useState, useCallback, useEffect } from 'react';
import { ChatTurn, TempChatTurn } from '@shared/index.ts';
import { getCachedMessages, saveMessagesToCache, loadAllCachedMessages } from '../../util/index.ts'; // Ensure this path is correct

// Type for the function that will be passed in to fetch older turns
type FetchOlderTurnsFunction = (
	sessionId: string,
	beforeSequence: number,
	limit: number
) => Promise<ChatTurn[]>;

export const useChatState = (sessionId: string) => {
	const [chatTurns, setChatTurns] = useState<ChatTurn[]>([]); // Sorted: oldest at index 0, newest at end
	const [isLoading, setIsLoading] = useState(false);
	const [hasMore, setHasMore] = useState(true);
	const [clientError, setClientError] = useState<string | undefined>();
	const [tempChatTurn, setTempChatTurn] = useState<TempChatTurn | undefined>();

	const _sortTurns = (turns: ChatTurn[]) => turns.sort((a, b) => a.sequence - b.sequence);

	// Function to load older messages, taking the fetcher as an argument
	const loadOlderMessages = useCallback(
		async (fetcher: FetchOlderTurnsFunction, batchSize: number = 10) => {
			if (isLoading || !hasMore) {
				if (!hasMore) console.log('No more older messages to load.');
				return;
			}

			setIsLoading(true);
			setClientError(undefined);
			try {
				// Sequence of the oldest message currently in state (start of the array)
				const oldestLoadedSequence = chatTurns.length > 0 ? chatTurns[0].sequence : Infinity;

				if (oldestLoadedSequence === Infinity && chatTurns.length > 0) {
					// This implies we have chatTurns but the first one doesn't have a sequence,
					// or chatTurns[0] is undefined. This case should be rare if data is consistent.
					// For safety, we might prevent fetching or log an error.
					console.warn(
						'Attempting to load older messages but oldest sequence is Infinity with existing turns.'
					);
					setHasMore(false); // Can't determine 'beforeSequence'
					setIsLoading(false);
					return;
				}

				// 1. Try to get from local IndexedDB first
				const cachedOlder = await getCachedMessages(oldestLoadedSequence, batchSize);

				if (cachedOlder.length > 0) {
					const sortedCachedOlder = cachedOlder.sort((a, b) => a.sequence - b.sequence);
					setChatTurns((prev) => [...sortedCachedOlder, ...prev]);
					// If cache provides items, check if it provided a full batch
					setHasMore(cachedOlder.length === batchSize);
				} else {
					// 2. If not in cache (or cache exhausted for this range), fetch from server
					const serverTurns = await fetcher(sessionId, oldestLoadedSequence, batchSize);
					if (serverTurns.length > 0) {
						const sortedServerTurns = serverTurns.sort((a, b) => a.sequence - b.sequence);
						setChatTurns((prev) => [...sortedServerTurns, ...prev]);
						await saveMessagesToCache(sortedServerTurns);
						setHasMore(serverTurns.length === batchSize);
					} else {
						setHasMore(false); // No more turns from server
					}
				}
			} catch (err: any) {
				console.error('Load Older Messages Error:', err);
				setClientError('Failed to load older messages.');
				setHasMore(false); // Stop trying if there's an error
			} finally {
				setIsLoading(false);
			}
		},
		[sessionId, isLoading, hasMore, chatTurns] // fetcher is not a dependency if stable from useChatApi
	);

	// Add a new fixed turn (appended at the end - newest)
	const addChatTurn = useCallback(async (turn: ChatTurn) => {
		setChatTurns((prev) => [...prev, turn].sort((a, b) => a.sequence - b.sequence));
		await saveMessagesToCache([turn]);
	}, []);

	const addMultipleTurns = useCallback(
		async (newTurns: ChatTurn[]) => {
			if (newTurns.length === 0) return;

			setChatTurns((prevTurns) => {
				// Create a map of existing turns for quick lookup to avoid duplicates
				const existingSequenceMap = new Map(prevTurns.map((t) => [t.sequence, t]));
				// Filter newTurns to only include those not already present
				const uniqueNewTurns = newTurns.filter((nt) => !existingSequenceMap.has(nt.sequence));
				// Combine and sort
				return _sortTurns([...prevTurns, ...uniqueNewTurns]);
			});
			// Cache only the new turns that were actually added (or all newTurns if you want to ensure cache has them)
			await saveMessagesToCache(newTurns); // Consider caching only uniqueNewTurns if performance is an issue
		},
		[_sortTurns]
	); // Dependency on sortTurns

	const changeTempChatTurn = useCallback((temp?: TempChatTurn) => {
		setTempChatTurn(temp);
	}, []);

	const clearChatState = useCallback(() => {
		setChatTurns([]);
		setTempChatTurn(undefined);
		setIsLoading(false);
		setClientError(undefined);
		setHasMore(true);
	}, []);

	const getCurrentSequence = useCallback((): number => {
		if (chatTurns.length === 0) return -1;
		return chatTurns[chatTurns.length - 1].sequence; // Last item is newest
	}, [chatTurns]);

	const getNextSequence = useCallback((): number => {
		const seq = getCurrentSequence();
		return seq === -1 ? 0 : seq + 1;
	}, [getCurrentSequence]);

	// Initial load from cache - called by ChatPage
	const initializeSession = useCallback(
		async (fetcher: FetchOlderTurnsFunction, initialBatchSize: number = 20) => {
			if (!sessionId) return;
			setIsLoading(true);
			setClientError(undefined);
			clearChatState(); // Start fresh

			try {
				let turnsToSet: ChatTurn[] = [];
				const cachedTurns = await loadAllCachedMessages(); // Assuming this filters by session or DB is per session

				if (cachedTurns.length > 0) {
					turnsToSet = cachedTurns;
				}

				// Always try to fetch latest from server, or initial if cache is empty
				// Use Infinity to get the absolute newest, or the sequence of the newest cached item
				const seqForServerFetch =
					turnsToSet.length > 0 ? turnsToSet[turnsToSet.length - 1].sequence : Infinity;

				// If fetching newest, 'beforeSequence' should be high (Infinity), or your API needs a way to get "latest N"
				// Let's assume getLoadingChatTurns(sessionId, Infinity, limit) gets the N most RECENT turns.
				const serverTurns = await fetcher(sessionId, Infinity, initialBatchSize);

				if (serverTurns.length > 0) {
					// Merge server turns with cached turns, ensuring uniqueness and correct order
					const combinedMap = new Map<number, ChatTurn>();
					turnsToSet.forEach((t) => combinedMap.set(t.sequence, t));
					serverTurns.forEach((t) => combinedMap.set(t.sequence, t)); // Server data might be fresher

					turnsToSet = Array.from(combinedMap.values());
					await saveMessagesToCache(serverTurns); // Cache the fresh server data
				}

				setChatTurns(_sortTurns(turnsToSet));
				setHasMore(
					serverTurns.length === initialBatchSize || (serverTurns.length === 0 && cachedTurns.length > 0)
				); // More if server gave full batch, or if cache has items but server didn't.
			} catch (err: any) {
				console.error('Initialize Session Error:', err);
				setClientError('Failed to initialize chat session.');
				setHasMore(false);
			} finally {
				setIsLoading(false);
			}
		},
		[sessionId, clearChatState, _sortTurns]
	);

	return {
		chatTurns,
		tempChatTurn,
		isLoadingChat: isLoading,
		clientError,
		hasMore,
		initializeSession, // Expose for ChatPage to call on mount
		loadOlderMessages, // Expose for InfiniteScroll, ChatPage will pass the fetcher
		addChatTurn,
		addMultipleTurns,
		changeTempChatTurn,
		setIsLoadingChat: setIsLoading,
		setClientError,
		setHasMore,
		clearChatState,
		getCurrentSequence,
		getNextSequence,
	};
};
