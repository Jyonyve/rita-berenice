// src/client/hooks/useChatApi.ts

import { useState, useCallback } from 'react';
import {
	apiClient,
	genApiUrl,
	MODULE_NAMES,
	ApiError,
	ChatResponse,
	ChatTurn,
	TempChatTurn,
} from '#shared/index.ts';
import { Where } from 'chromadb'; // Assuming these types are available on the client
import { useToast } from '../../component/index.ts';

/**
 * A client-side hook for interacting with the CHAT and TEMP_CHAT API endpoints.
 * It encapsulates API logic, loading/error states, and user notifications via a toast system.
 */
export const useChatApi = () => {
	// --- Hooks ---
	const [loading, setLoading] = useState<boolean>(false);
	const [error, setError] = useState<ApiError | null>(null);
	const { addToast } = useToast();

	// --- Fixed Chat Turn Operations ---

	/**
	 * Stores a finalized chat turn.
	 * @param chatTurn The complete ChatTurn object to store.
	 * @returns The stored ChatTurn object from the server, or null on failure.
	 */
	const storeChatTurn = useCallback(
		async (chatTurn: ChatTurn): Promise<ChatTurn | null> => {
			setLoading(true);
			setError(null);
			try {
				const url = genApiUrl(MODULE_NAMES.CHAT, 'storeChatTurn');
				// Your server route was updated to return the object, not a string
				const response = await apiClient.post<ChatTurn>(url, chatTurn);
				addToast('Chat turn saved.', 'success');
				return response.data;
			} catch (err) {
				const apiError = err as ApiError;
				addToast(apiError.clientMessage || 'Failed to save chat turn.', 'error');
				setError(apiError);
				return null;
			} finally {
				setLoading(false);
			}
		},
		[addToast]
	);

	/**
	 * Fetches a list of chat turns for history loading.
	 * @param sessionId The session ID.
	 * @param beforeSequence Fetches turns with a sequence number less than this value.
	 * @returns A ChatResponse object, or null on failure.
	 */
	const getChatTurns = useCallback(
		async (sessionId: string, beforeSequence: number): Promise<ChatResponse | null> => {
			setLoading(true);
			setError(null);
			try {
				const url = genApiUrl(MODULE_NAMES.CHAT, 'getChatTurns', [sessionId]);
				const response = await apiClient.get<ChatResponse>(url, { params: { beforeSequence } });
				return response.data;
			} catch (err) {
				const apiError = err as ApiError;
				addToast(apiError.clientMessage || 'Failed to load chat history.', 'error');
				setError(apiError);
				return null;
			} finally {
				setLoading(false);
			}
		},
		[addToast]
	);

	/**
	 * Fetches a single, specific chat turn by its sequence number.
	 * @returns A ChatResponse containing the single turn, or null on failure.
	 */
	const getChatTurnBySequence = useCallback(
		async (sessionId: string, sequence: number): Promise<ChatResponse | null> => {
			setLoading(true);
			setError(null);
			try {
				const url = genApiUrl(MODULE_NAMES.CHAT, 'getChatTurnBySequence', [sessionId, sequence]);
				const response = await apiClient.get<ChatResponse>(url);
				return response.data;
			} catch (err) {
				const apiError = err as ApiError;
				addToast(apiError.clientMessage || 'Failed to load chat turn.', 'error');
				setError(apiError);
				return null;
			} finally {
				setLoading(false);
			}
		},
		[addToast]
	);

	/**
	 * Performs a semantic search over finalized chat turns.
	 * @returns A ChatResponse with matching turns, or null on failure.
	 */
	const queryChatTurns = useCallback(
		async (sessionId: string, queryTexts: string[], where?: Where): Promise<ChatResponse | null> => {
			setLoading(true);
			setError(null);
			try {
				const url = genApiUrl(MODULE_NAMES.CHAT, 'queryChatTurns');
				const response = await apiClient.post<ChatResponse>(url, { sessionId, queryTexts, where });
				return response.data;
			} catch (err) {
				const apiError = err as ApiError;
				addToast(apiError.clientMessage || 'Search failed.', 'error');
				setError(apiError);
				return null;
			} finally {
				setLoading(false);
			}
		},
		[addToast]
	);

	// --- Temporary Chat Turn Operations ---

	/**
	 * Saves a temporary chat turn object.
	 * @param tempData The TempChatTurn object to save.
	 * @returns True on success, false on failure.
	 */
	const saveTempChatTurn = useCallback(
		async (tempData: TempChatTurn): Promise<boolean> => {
			setLoading(true);
			setError(null);
			try {
				const url = genApiUrl(MODULE_NAMES.TEMP, 'saveTempChatTurn');
				await apiClient.post(url, tempData);
				// No toast on success for this, as it's a frequent background operation.
				return true;
			} catch (err) {
				const apiError = err as ApiError;
				addToast(apiError.clientMessage || 'Failed to save progress.', 'error');
				setError(apiError);
				return false;
			} finally {
				setLoading(false);
			}
		},
		[addToast]
	);

	/**
	 * Fetches a temporary chat turn. A 404 is a common, expected case (meaning it's the first
	 * generation for a turn), so no toast is shown for it.
	 * @returns The TempChatTurn object, or null if not found or on error.
	 */
	const getTempChatTurn = useCallback(
		async (sessionId: string, sequence: number): Promise<TempChatTurn | null> => {
			setLoading(true);
			setError(null);
			try {
				const url = genApiUrl(MODULE_NAMES.TEMP, 'getTempChatTurn', [sessionId, sequence]);
				const response = await apiClient.get<TempChatTurn>(url);
				return response.data;
			} catch (err) {
				const apiError = err as ApiError;
				setError(apiError);
				// Only show a toast if the error is something other than "Not Found".
				if (apiError.status !== 404) {
					addToast(apiError.clientMessage || 'Could not retrieve temp chat data.', 'error');
				}
				return null;
			} finally {
				setLoading(false);
			}
		},
		[addToast]
	);

	return {
		loading,
		error,
		// Fixed Turn methods
		storeChatTurn,
		getChatTurns,
		getChatTurnBySequence,
		queryChatTurns,
		// Temp Turn methods
		saveTempChatTurn,
		getTempChatTurn,
	};
};
