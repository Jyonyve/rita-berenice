// src/client/hooks/useLoreApi.ts

import {
	genApiUrl,
	MODULE_NAMES,
	LoreResponse,
	HistoryResponse,
	LoreInfo,
	HistoryInfo,
} from '#shared/index.js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '#server/util/serviceHelpers.js';
import { useToast } from '../../style/ToastProvider.tsx';
import { apiClient } from '../../util/index.js';

// For clarity in the query function signature
type QueryOptions = {
	categories?: string[];
	keywords?: string[];
	topics?: string[];
	limit?: number;
};

/**
 * A client-side hook for interacting with the LORE API endpoints, which handle
 * both lore and history entries, refactored for TanStack Query.
 */
export const useLoreApi = () => {
	const MODULE_NAME = MODULE_NAMES.LORE;
	const { addToast } = useToast();
	const queryClient = useQueryClient();

	// --- LORE OPERATIONS ---

	/**
	 * Stores a new or updated lore entry.
	 * Mutation key: 'storeLore'
	 */
	const storeLore = useMutation<boolean, ApiError, LoreInfo>({
		mutationFn: async (loreInfo: LoreInfo) => {
			const url = genApiUrl(MODULE_NAME, 'storeLore');
			await apiClient.post(url, loreInfo);
			return true;
		},
		onSuccess: () => {
			addToast('Lore entry saved successfully.', 'success');
			// Invalidate relevant lore queries
			queryClient.invalidateQueries({ queryKey: ['getLores'] }); // Invalidate all lores (if getLores returns all)
		},
		onError: (error: ApiError) => {
			addToast(error.clientMessage || 'Failed to save lore entry.', 'error');
		},
	});

	/**
	 * Fetches all lore entries for a specific character.
	 * Query key: ['getLores']
	 */
	const getLores = (characterId: string) =>
		useQuery<LoreResponse, ApiError>({
			queryKey: ['getLores', characterId], // Adjusted to include characterId in key
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getLores', [characterId]);
				const response = await apiClient.get<LoreResponse>(url);
				return response.data;
			},
			enabled: !!characterId,
		});

	/**
	 * Fetches a single lore entry by its unique ID.
	 * Query key: ['getLore']
	 */
	const getLore = (loreId: string) =>
		useQuery<LoreResponse, ApiError>({
			queryKey: ['getLore', loreId], // Adjusted to include loreId in key
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getLore', [loreId]);
				const response = await apiClient.get<LoreResponse>(url);
				return response.data;
			},
			enabled: !!loreId,
		});

	/**
	 * Performs a semantic search for lore entries.
	 * Mutation key: 'queryLores' (as it's a POST request for search)
	 */
	const queryLores = useMutation<
		LoreResponse,
		ApiError,
		{ characterId: string; queryTexts: string[]; options?: QueryOptions }
	>({
		mutationFn: async ({ characterId, queryTexts, options }) => {
			const url = genApiUrl(MODULE_NAME, 'queryLores');
			const response = await apiClient.post<LoreResponse>(url, { characterId, queryTexts, options });
			return response.data;
		},
		onError: (error: ApiError) => {
			addToast(error.clientMessage || 'Lore search failed.', 'error');
		},
	});

	// --- HISTORY OPERATIONS ---

	/**
	 * Stores a new or updated history entry.
	 * Mutation key: 'storeHistory'
	 */
	const storeHistory = useMutation<boolean, ApiError, HistoryInfo>({
		mutationFn: async (historyInfo: HistoryInfo) => {
			const url = genApiUrl(MODULE_NAME, 'storeHistory');
			await apiClient.post(url, historyInfo);
			return true;
		},
		onSuccess: () => {
			addToast('History entry saved successfully.', 'success');
			// Invalidate relevant history queries
			queryClient.invalidateQueries({ queryKey: ['getHistories'] }); // Invalidate all histories (if getHistories returns all)
		},
		onError: (error: ApiError) => {
			addToast(error.clientMessage || 'Failed to save history entry.', 'error');
		},
	});

	/**
	 * Fetches all history entries for a character, sorted by sequence.
	 * Query key: ['getHistories']
	 */
	const getHistories = (characterId: string) =>
		useQuery<HistoryResponse, ApiError>({
			queryKey: ['getHistories', characterId], // Adjusted to include characterId in key
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getHistories', [characterId]);
				const response = await apiClient.get<HistoryResponse>(url);
				return response.data;
			},
			enabled: !!characterId,
		});

	/**
	 * Performs a semantic search for history entries.
	 * Mutation key: 'queryHistories' (as it's a POST request for search)
	 */
	const queryHistories = useMutation<
		HistoryResponse,
		ApiError,
		{ characterId: string; queryTexts: string[]; options?: { limit?: number } }
	>({
		mutationFn: async ({ characterId, queryTexts, options }) => {
			const url = genApiUrl(MODULE_NAME, 'queryHistories');
			const response = await apiClient.post<HistoryResponse>(url, {
				characterId,
				queryTexts,
				options,
			});
			return response.data;
		},
		onError: (error: ApiError) => {
			addToast(error.clientMessage || 'History search failed.', 'error');
		},
	});

	return {
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
