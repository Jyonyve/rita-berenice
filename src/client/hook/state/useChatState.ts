import { useState, useCallback, useEffect } from 'react';
import { DisplayTurn, TempChatTurn } from '#shared/domain/chat/chat.type.js';
import { loadAllCachedMessagesForSession, saveMessagesToCache } from '../../util/idbUtils.js';
import { useChatApi, useTempChatApi } from '../api/index.js';
import { RECENT_CHAT_TURN } from '#shared/config/constants.js';

export const useChatState = (sessionId: string) => {
	// --- STATE MANAGEMENT ---
	const [chatTurns, setChatTurns] = useState<DisplayTurn[]>([]);
	const [isCacheLoading, setIsCacheLoading] = useState(true);
	const [clientError, setClientError] = useState<string>();
	const [tempChatTurn, setTempChatTurn] = useState<TempChatTurn>();

	// --- API HOOK ---
	// This hook is called declaratively at the top level.
	// It automatically runs when `sessionId` is valid and fetches the latest data.
	const {
		data: apiResponse,
		isLoading: isApiLoading,
		isError: isApiError,
		error: apiError,
	} = useChatApi().getAllDisplayTurns(sessionId);

	// --- UTILITY FUNCTIONS ---
	const _sortTurns = useCallback(
		(turns: DisplayTurn[]) => turns.sort((a, b) => a.sequence - b.sequence),
		[]
	);

	const clearChatState = useCallback(() => {
		setChatTurns([]);
		setTempChatTurn(undefined);
		setIsCacheLoading(true);
		setClientError(undefined);
	}, []);

	// --- DATA FLOW & LIFECYCLE ---

	// EFFECT 1: Handles the initial, fast load from the local cache when the session changes.
	useEffect(() => {
		const loadFromCache = async () => {
			if (!sessionId) {
				clearChatState();
				return;
			}
			// Immediately clear old state and prepare for new session
			clearChatState();
			try {
				const cachedTurns = await loadAllCachedMessagesForSession(sessionId);
				if (cachedTurns.length > 0) {
					setChatTurns(_sortTurns(cachedTurns));
				}
			} catch (err: any) {
				console.error(`Failed to load session ${sessionId} from cache:`, err);
				setClientError('Failed to load chat from local cache.');
			} finally {
				setIsCacheLoading(false);
			}
		};

		loadFromCache();

		// Cleanup function to clear state if component unmounts
		return () => clearChatState();
	}, [sessionId, _sortTurns, clearChatState]);

	// EFFECT 2: Reacts to the API data to "revalidate" the UI and update the cache.
	useEffect(() => {
		if (isApiError) {
			setClientError(`Server error: ${apiError?.message || 'Failed to sync with server.'}`);
			return;
		}

		if (apiResponse?.displayTurns) {
			const sortedApiTurns = _sortTurns(apiResponse.displayTurns);
			// Update state and cache only if the server data is different from what's currently shown.
			// This prevents unnecessary re-renders.
			if (JSON.stringify(sortedApiTurns) !== JSON.stringify(chatTurns)) {
				setChatTurns(sortedApiTurns);
				saveMessagesToCache(sortedApiTurns);
			}
		}
	}, [apiResponse, isApiError, apiError, chatTurns, _sortTurns]);

	// --- STATE UPDATERS & GETTERS ---

	const addChatTurn = useCallback(
		async (turn: DisplayTurn) => {
			setChatTurns((prev) => _sortTurns([...prev, turn]));
			await saveMessagesToCache([turn]);
		},
		[_sortTurns]
	);

	const addChatTurns = useCallback(
		async (newTurns: DisplayTurn[]) => {
			if (newTurns.length === 0) return;
			setChatTurns((prevTurns) => {
				const existingSequences = new Set(prevTurns.map((t) => t.sequence));
				const uniqueNewTurns = newTurns.filter((nt) => !existingSequences.has(nt.sequence));
				return _sortTurns([...prevTurns, ...uniqueNewTurns]);
			});
			await saveMessagesToCache(newTurns);
		},
		[_sortTurns]
	);

	const changeTempChatTurn = useCallback((temp?: TempChatTurn) => {
		setTempChatTurn(temp);
	}, []);

	const getCurrentSequence = useCallback((): number => {
		if (chatTurns.length === 0) return -1;
		return chatTurns[chatTurns.length - 1].sequence; // Last item is newest
	}, [chatTurns]);

	const getNextSequence = useCallback((): number => {
		let seq = getCurrentSequence();
		return seq === -1 ? 0 : ++seq;
	}, [getCurrentSequence]);

	const getRecentTurnsForMemory = useCallback((): DisplayTurn[] => {
		return chatTurns.slice(-RECENT_CHAT_TURN);
	}, [chatTurns]);

	// --- RETURNED VALUES ---
	return {
		chatTurns,
		tempChatTurn,
		isLoadingHistory: isCacheLoading || isApiLoading,
		clientError,
		addChatTurn,
		addChatTurns,
		changeTempChatTurn,
		clearChatState,
		getCurrentSequence,
		getNextSequence,
		getRecentTurnsForMemory,
	};
};
