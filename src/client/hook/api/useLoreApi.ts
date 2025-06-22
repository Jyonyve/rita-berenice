// src/client/hooks/useLoreApi.ts

import { useState, useCallback } from 'react';
import {
	apiClient,
	genApiUrl,
	MODULE_NAMES,
	ApiError,
	LoreResponse,
	HistoryResponse,
	LoreInfo,
	HistoryInfo,
} from '#shared/index.ts';
import { useToast } from '../../component/index.ts';

// For clarity in the query function signature
type QueryOptions = {
	categories?: string[];
	keywords?: string[];
	topics?: string[];
	limit?: number;
};

/**
 * A client-side hook for interacting with the LORE API endpoints, which handle
 * both lore and history entries. It encapsulates API logic, loading/error states,
 * and user notifications via a toast system.
 */
export const useLoreApi = () => {
	const MODULE_NAME = MODULE_NAMES.LORE;

	// --- Hooks ---
	const [loading, setLoading] = useState<boolean>(false);
	const [error, setError] = useState<ApiError | null>(null);
	const { addToast } = useToast();

	// --- LORE OPERATIONS ---

	/**
	 * Stores a new or updated lore entry.
	 * @param loreInfo The lore data to save.
	 * @returns A boolean indicating success or failure.
	 */
	const storeLore = useCallback(
		async (loreInfo: LoreInfo): Promise<boolean> => {
			setLoading(true);
			setError(null);
			try {
				const url = genApiUrl(MODULE_NAME, 'storeLore');
				await apiClient.post(url, loreInfo);
				addToast('Lore entry saved successfully.', 'success');
				return true;
			} catch (err) {
				const apiError = err as ApiError;
				addToast(apiError.clientMessage || 'Failed to save lore entry.', 'error');
				setError(apiError);
				return false;
			} finally {
				setLoading(false);
			}
		},
		[addToast]
	);

	/**
	 * Fetches all lore entries for a specific character.
	 * @param characterId The ID of the character.
	 * @returns A LoreResponse object, or null on failure.
	 */
	const getLores = useCallback(
		async (characterId: string): Promise<LoreResponse | null> => {
			setLoading(true);
			setError(null);
			try {
				const url = genApiUrl(MODULE_NAME, 'getLores', [characterId]);
				const response = await apiClient.get<LoreResponse>(url);
				return response.data;
			} catch (err) {
				const apiError = err as ApiError;
				addToast(apiError.clientMessage || 'Failed to load lore.', 'error');
				setError(apiError);
				return null;
			} finally {
				setLoading(false);
			}
		},
		[addToast]
	);

	/**
	 * Fetches a single lore entry by its unique ID.
	 * @param loreId The ID of the lore entry.
	 * @returns A LoreResponse object, or null on failure.
	 */
	const getLore = useCallback(
		async (loreId: string): Promise<LoreResponse | null> => {
			setLoading(true);
			setError(null);
			try {
				const url = genApiUrl(MODULE_NAME, 'getLore', [loreId]);
				const response = await apiClient.get<LoreResponse>(url);
				return response.data;
			} catch (err) {
				const apiError = err as ApiError;
				addToast(apiError.clientMessage || 'Failed to load lore entry.', 'error');
				setError(apiError);
				return null;
			} finally {
				setLoading(false);
			}
		},
		[addToast]
	);

	/**
	 * Performs a semantic search for lore entries.
	 * @returns A LoreResponse with matching entries, or null on failure.
	 */
	const queryLores = useCallback(
		async (
			characterId: string,
			queryTexts: string[],
			options?: QueryOptions
		): Promise<LoreResponse | null> => {
			setLoading(true);
			setError(null);
			try {
				const url = genApiUrl(MODULE_NAME, 'queryLores');
				const response = await apiClient.post<LoreResponse>(url, { characterId, queryTexts, options });
				return response.data;
			} catch (err) {
				const apiError = err as ApiError;
				addToast(apiError.clientMessage || 'Lore search failed.', 'error');
				setError(apiError);
				return null;
			} finally {
				setLoading(false);
			}
		},
		[addToast]
	);

	// --- HISTORY OPERATIONS ---

	/**
	 * Stores a new or updated history entry.
	 * @param historyInfo The history data to save.
	 * @returns A boolean indicating success or failure.
	 */
	const storeHistory = useCallback(
		async (historyInfo: HistoryInfo): Promise<boolean> => {
			setLoading(true);
			setError(null);
			try {
				const url = genApiUrl(MODULE_NAME, 'storeHistory');
				await apiClient.post(url, historyInfo);
				addToast('History entry saved successfully.', 'success');
				return true;
			} catch (err) {
				const apiError = err as ApiError;
				addToast(apiError.clientMessage || 'Failed to save history entry.', 'error');
				setError(apiError);
				return false;
			} finally {
				setLoading(false);
			}
		},
		[addToast]
	);

	/**
	 * Fetches all history entries for a character, sorted by sequence.
	 * @param characterId The ID of the character.
	 * @returns A HistoryResponse object, or null on failure.
	 */
	const getHistories = useCallback(
		async (characterId: string): Promise<HistoryResponse | null> => {
			setLoading(true);
			setError(null);
			try {
				const url = genApiUrl(MODULE_NAME, 'getHistories', [characterId]);
				const response = await apiClient.get<HistoryResponse>(url);
				return response.data;
			} catch (err) {
				const apiError = err as ApiError;
				addToast(apiError.clientMessage || 'Failed to load history.', 'error');
				setError(apiError);
				return null;
			} finally {
				setLoading(false);
			}
		},
		[addToast]
	);

	/**
	 * Performs a semantic search for history entries.
	 * @returns A HistoryResponse with matching entries, or null on failure.
	 */
	const queryHistories = useCallback(
		async (
			characterId: string,
			queryTexts: string[],
			options?: { limit?: number }
		): Promise<HistoryResponse | null> => {
			setLoading(true);
			setError(null);
			try {
				const url = genApiUrl(MODULE_NAME, 'queryHistories');
				const response = await apiClient.post<HistoryResponse>(url, {
					characterId,
					queryTexts,
					options,
				});
				return response.data;
			} catch (err) {
				const apiError = err as ApiError;
				addToast(apiError.clientMessage || 'History search failed.', 'error');
				setError(apiError);
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
		// Lore methods
		storeLore,
		getLores,
		getLore,
		queryLores,
		// History methods
		storeHistory,
		getHistories,
		queryHistories,
	};
};
