import { useState, useCallback, useEffect } from 'react';
import { clearSessionCache, loadAllCachedMessagesForSession, saveMessagesToCache } from '../../util/idbUtils.js';
import { useChatApi, useTempChatApi } from '../api/index.js';
import { DisplayTurn, TempChatTurn } from '@rita-berenice/shared/domain';
import { RECENT_CHAT_TURN } from '@rita-berenice/shared/config';
import { getClientErrorMessage } from '../../util/clientApiHelpers.js';

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
  // Copies before sorting: the API turns handed in here belong to react-query's cache, and
  // sorting them in place mutates cached data other consumers read.
  const _sortTurns = useCallback((turns: DisplayTurn[]) => [...turns].sort((a, b) => a.sequence - b.sequence), []);

  // Reuses the existing object for every turn that did not actually change. Replacing the whole
  // array wholesale gives each row new props, and new props make Virtuoso re-measure every row -
  // which is what shifts the scroll position when a revalidation lands.
  const _mergeTurns = useCallback((current: DisplayTurn[], incoming: DisplayTurn[]) => {
    const currentBySequence = new Map(current.map((turn) => [turn.sequence, turn]));
    let hasChanged = current.length !== incoming.length;

    const merged = incoming.map((nextTurn, index) => {
      const previousTurn = currentBySequence.get(nextTurn.sequence);
      if (previousTurn && JSON.stringify(previousTurn) === JSON.stringify(nextTurn)) {
        // Order counts as a change even when the turn itself is untouched.
        if (current[index] !== previousTurn) hasChanged = true;
        return previousTurn;
      }
      hasChanged = true;
      return nextTurn;
    });

    return hasChanged ? merged : current;
  }, []);

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
      setClientError(getClientErrorMessage(apiError, 'Unable to sync chat history. Please try again.'));
      return;
    }

    if (apiResponse?.displayTurns) {
      const sortedApiTurns = _sortTurns(apiResponse.displayTurns);
      setChatTurns((currentTurns) => _mergeTurns(currentTurns, sortedApiTurns));
      saveMessagesToCache(sortedApiTurns);
    }
  }, [apiResponse, isApiError, apiError, _sortTurns, _mergeTurns]);

  // --- STATE UPDATERS & GETTERS ---

  const addChatTurn = useCallback(
    async (turn: DisplayTurn) => {
      setChatTurns((previousTurns) =>
        _sortTurns([...previousTurns.filter((existingTurn) => existingTurn.sequence !== turn.sequence), turn]),
      );
      await saveMessagesToCache([turn]);
    },
    [_sortTurns],
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
    [_sortTurns],
  );

  const changeTempChatTurn = useCallback((temp?: TempChatTurn) => {
    setTempChatTurn(temp);
  }, []);

  // Deleting a turn hard-deletes it and everything after it (tail truncation, not
  // renumbering). The IndexedDB cache has no per-row delete, so the whole session's local
  // cache is cleared here to avoid resurrecting deleted turns on next load; it gets
  // re-populated from the server response as usual.
  const removeChatTurnsFromSequence = useCallback(
    async (fromSequence: number) => {
      setChatTurns((previousTurns) => previousTurns.filter((turn) => turn.sequence < fromSequence));
      await clearSessionCache(sessionId);
    },
    [sessionId],
  );

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
    removeChatTurnsFromSequence,
    clearChatState,
    getCurrentSequence,
    getNextSequence,
    getRecentTurnsForMemory,
  };
};
