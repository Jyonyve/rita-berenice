import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../provider/ToastProvider.tsx';
import { apiClient, genApiUrl } from '../../util/clientApiHelpers.js';
import { LANG_KEYS, MODULE_NAMES } from '@rita-berenice/shared/config';
import { HistoryInfo } from '@rita-berenice/shared/domain';
import { HistoryResponse } from '@rita-berenice/shared/api';
import { getLangAlertText } from '../../util/translateUtils.js';

/**
 * A client-side hook for interacting with the LORE API endpoints, which handle
 * both lore and history entries, with separate hierarchies for each.
 */
export const useHistoryApi = () => {
	const MODULE_NAME = MODULE_NAMES.HISTORY;
	const { addToast } = useToast();
	const queryClient = useQueryClient();

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
			addToast(getLangAlertText(LANG_KEYS.HISTORY_SAVED_SUCCESS), 'success');

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
				const response = await apiClient.get<HistoryResponse>(url);
				return response.data;
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
				const response = await apiClient.get<HistoryResponse>(url);
				return response.data;
			},
			enabled: !!historyId,
		});

	return { storeHistory: storeHistory.mutateAsync, getHistories, getHistory };
};
