import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../provider/ToastProvider.jsx';
import { getLangAlertText } from '../../util/translateUtils.js';
import { LoreResponse } from '@rita-berenice/shared/api';
import { MODULE_NAMES, LANG_KEYS } from '@rita-berenice/shared/config';
import { LoreInfo } from '@rita-berenice/shared/domain';
import { Payload } from '@rita-berenice/shared/util';
import { genApiUrl, apiClient, decompressData } from '../../util/clientApiHelpers.js';

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
			addToast(getLangAlertText(LANG_KEYS.LORE_SAVED_SUCCESS), 'success');

			// Invalidate the specific lore entry
			queryClient.invalidateQueries({ queryKey: ['lore', 'detail', 'getLore', data.loreId] });

			// Invalidate all lore lists for this character
			if (variables.characterIds && variables.characterIds.length > 0) {
				const invalidationPromises = variables.characterIds.map((characterId) =>
					queryClient.invalidateQueries({
						queryKey: ['lore', 'list', 'getLoresByCharacter', characterId],
					})
				);
				// Use Promise.all to wait for all invalidations to be triggered.
				Promise.all(invalidationPromises);
			}
		},
	});

	/**
	 * Fetches all lore entries for a specific character.
	 */
	const getLoresByCharacter = (characterId: string) =>
		useQuery<LoreResponse, Error>({
			queryKey: ['lore', 'list', 'getLoresByCharacter', characterId], // Separate lore hierarchy
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getLoresByCharacter', [characterId]);
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

	return { storeLore: storeLore.mutateAsync, getLoresByCharacter, getLore };
};
