import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../provider/ToastProvider.jsx';
import { apiClient, decompressData, genApiUrl } from '../../util/clientApiHelpers.js';
import { MODULE_NAMES } from '#shared/config/constants.js';
import { HistoryInfo, LoreInfo } from '#shared/domain/lore/LoreInterfaces.js';
import { Payload } from '#shared/util/apiHelpers.js';
import { HistoryResponse, LoreResponse } from '#shared/api/ModuleResponse.js';

/**
 * A client-side hook for interacting with the LORE API endpoints, which handle
 * both lore and history entries, with separate hierarchies for each.
 */
export const useLoreApi = () => {
	const MODULE_NAME = MODULE_NAMES.LORE;
	const { addToast } = useToast();
	const queryClient = useQueryClient();

	// --- LORE OPERATIONS ---

	/**
	 * Stores a new or updated lore entry.
	 */
	const storeLore = useMutation<{ loreId: string }, Error, LoreInfo>({
		mutationFn: async (loreInfo) => {
			const url = genApiUrl(MODULE_NAME, 'storeLore');
			const response = await apiClient.post<{ loreId: string }>(url, loreInfo);
			return response.data;
		},
		onSuccess: (data, variables) => {
			addToast('Lore entry saved successfully.', 'success');

			// Invalidate the specific lore entry
			queryClient.invalidateQueries({ queryKey: ['lore', 'detail', 'getLore', data.loreId] });

			// Invalidate all lore lists for this character
			queryClient.invalidateQueries({ queryKey: ['lore', 'list', 'getLores', variables.characterId] });
		},
	});

	/**
	 * Fetches all lore entries for a specific character.
	 */
	const getLores = (characterId: string) =>
		useQuery<LoreResponse, Error>({
			queryKey: ['lore', 'list', 'getLores', characterId], // Separate lore hierarchy
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
			queryKey: ['lore', 'detail', 'getLore', loreId], // Separate lore hierarchy
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
	 */
	const storeHistory = useMutation<{ historyId: string }, Error, HistoryInfo>({
		mutationFn: async (historyInfo) => {
			const url = genApiUrl(MODULE_NAME, 'storeHistory');
			const response = await apiClient.post<{ historyId: string }>(url, historyInfo);
			return response.data;
		},
		onSuccess: (data, variables) => {
			addToast('History entry saved successfully.', 'success');

			// Invalidate the specific history entry
			queryClient.invalidateQueries({ queryKey: ['history', 'detail', 'getHistory', data.historyId] });

			// Invalidate all history lists for this character
			queryClient.invalidateQueries({
				queryKey: ['history', 'list', 'getHistories', variables.characterId],
			});
		},
	});

	/**
	 * Fetches all history entries for a character.
	 */
	const getHistories = (characterId: string) =>
		useQuery<HistoryResponse, Error>({
			queryKey: ['history', 'list', 'getHistories', characterId], // Separate history hierarchy
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
			queryKey: ['history', 'detail', 'getHistory', historyId], // Separate history hierarchy
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
