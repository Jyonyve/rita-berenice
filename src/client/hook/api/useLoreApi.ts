import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../provider/ToastProvider.jsx';
import { apiClient, decompressData, genApiUrl } from '../../util/clientApiHelpers.js';
import { MODULE_NAMES } from '#shared/config/constants.js';
import { HistoryInfo, LoreInfo } from '#shared/domain/lore/LoreInterfaces.js';
import { Payload } from '#shared/util/apiHelpers.js';
import { HistoryResponse, LoreResponse } from '#shared/api/ModuleResponse.js';

// For clarity in a potential future search/query function
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
	 * REFACTORED: Now expects a { loreId: string } object from the server.
	 */
	const storeLore = useMutation<{ loreId: string }, Error, LoreInfo>({
		mutationFn: async (loreInfo) => {
			const url = genApiUrl(MODULE_NAME, 'storeLore');
			const response = await apiClient.post<{ loreId: string }>(url, loreInfo);
			return response.data;
		},
		onSuccess: (data, variables) => {
			addToast('Lore entry saved successfully.', 'success');
			// Invalidate all relevant queries concurrently
			Promise.all([
				queryClient.invalidateQueries({ queryKey: ['getLores', variables.characterId] }),
				queryClient.invalidateQueries({ queryKey: ['getLore', data.loreId] }),
			]);
		},
	});

	/**
	 * Fetches all lore entries for a specific character.
	 */
	const getLores = (characterId: string) =>
		useQuery<LoreResponse, Error>({
			queryKey: ['getLores', characterId],
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getLores', [characterId]);
				const response = await apiClient.get<Payload>(url);
				return decompressData<LoreResponse>(response.data.payload);
			},
			enabled: !!characterId,
		});

	/**
	 * Fetches a single lore entry by its unique ID.
	 */
	const getLore = (loreId: string) =>
		useQuery<LoreResponse, Error>({
			queryKey: ['getLore', loreId],
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getLore', [loreId]);
				const response = await apiClient.get<Payload>(url);
				return decompressData<LoreResponse>(response.data.payload);
			},
			enabled: !!loreId,
		});

	// --- HISTORY OPERATIONS ---

	/**
	 * Stores a new or updated history entry.
	 * REFACTORED: Now expects a { historyId: string } object from the server.
	 */
	const storeHistory = useMutation<{ historyId: string }, Error, HistoryInfo>({
		mutationFn: async (historyInfo) => {
			const url = genApiUrl(MODULE_NAME, 'storeHistory');
			const response = await apiClient.post<{ historyId: string }>(url, historyInfo);
			return response.data;
		},
		onSuccess: (data, variables) => {
			addToast('History entry saved successfully.', 'success');
			// Invalidate all relevant queries concurrently
			Promise.all([
				queryClient.invalidateQueries({ queryKey: ['getHistories', variables.characterId] }),
				queryClient.invalidateQueries({ queryKey: ['getHistory', data.historyId] }),
			]);
		},
	});

	/**
	 * Fetches all history entries for a character.
	 */
	const getHistories = (characterId: string) =>
		useQuery<HistoryResponse, Error>({
			queryKey: ['getHistories', characterId],
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getHistories', [characterId]);
				const response = await apiClient.get<Payload>(url);
				return decompressData<HistoryResponse>(response.data.payload);
			},
			enabled: !!characterId,
		});

	/**
	 * Fetches a single history entry by its unique ID.
	 */
	const getHistory = (historyId: string) =>
		useQuery<HistoryResponse, Error>({
			queryKey: ['getHistory', historyId],
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getHistory', [historyId]);
				const response = await apiClient.get<Payload>(url);
				return decompressData<HistoryResponse>(response.data.payload);
			},
			enabled: !!historyId,
		});

	return {
		storeLore: storeLore.mutateAsync,
		getLores,
		getLore,
		storeHistory: storeHistory.mutateAsync,
		getHistories,
		getHistory,
	};
};
