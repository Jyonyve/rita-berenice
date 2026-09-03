import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../provider/ToastProvider.jsx';
import { getLangAlertText } from '../../util/translateUtils.js';
import { LoreResponse } from '@rita-berenice/shared/api';
import { MODULE_NAMES, LANG_KEYS } from '@rita-berenice/shared/config';
import { LoreInfo } from '@rita-berenice/shared/domain';
import { genApiUrl, apiClient } from '../../util/clientApiHelpers.js';

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
      addToast(
        getLangAlertText(variables.sessionId ? LANG_KEYS.MEMORY_SAVED_SUCCESS : LANG_KEYS.LORE_SAVED_SUCCESS),
        'success',
      );

      // Invalidate the specific lore entry
      queryClient.invalidateQueries({ queryKey: ['lore', 'detail', 'getLore', data.loreId] });

      // Invalidate all lore lists for this character
      if (variables.characterIds && variables.characterIds.length > 0) {
        const invalidationPromises = variables.characterIds.flatMap((characterId) => [
          queryClient.invalidateQueries({
            queryKey: ['lore', 'list', 'getActiveLoresByCharacter', characterId],
          }),
          queryClient.invalidateQueries({
            queryKey: ['lore', 'list', 'getEditableLoresByCharacter', characterId],
          }),
        ]);
        // Use Promise.all to wait for all invalidations to be triggered.
        Promise.all(invalidationPromises);
      }
      if (variables.sessionId) {
        queryClient.invalidateQueries({
          queryKey: ['lore', 'list', 'getLoresBySession', variables.sessionId],
        });
      }
    },
  });

  /**
   * Fetches all lore entries for a specific character.
   */
  const getActiveLoresByCharacter = (characterId: string) =>
    useQuery<LoreResponse, Error>({
      queryKey: ['lore', 'list', 'getActiveLoresByCharacter', characterId],
      queryFn: async () => {
        const url = genApiUrl(MODULE_NAME, 'getActiveLoresByCharacter', [characterId]);
        const response = await apiClient.get<LoreResponse>(url);
        return response.data;
      },
      enabled: !!characterId,
    });

  const getEditableLoresByCharacter = (characterId: string) =>
    useQuery<LoreResponse, Error>({
      queryKey: ['lore', 'list', 'getEditableLoresByCharacter', characterId],
      queryFn: async () => {
        const url = genApiUrl(MODULE_NAME, 'getEditableLoresByCharacter', [characterId]);
        const response = await apiClient.get<LoreResponse>(url);
        return response.data;
      },
      enabled: !!characterId,
    });

  const getLoresBySession = (sessionId: string) =>
    useQuery<LoreResponse, Error>({
      queryKey: ['lore', 'list', 'getLoresBySession', sessionId],
      queryFn: async () => {
        const url = genApiUrl(MODULE_NAME, 'getLoresBySession', [sessionId]);
        const response = await apiClient.get<LoreResponse>(url);
        return response.data;
      },
      enabled: !!sessionId,
    });

  /**
   * Fetches a single lore entry by its unique ID.
   */
  const getLore = (loreId: string) =>
    useQuery<LoreResponse, Error>({
      queryKey: ['lore', 'detail', 'getLore', loreId], // Separate lore hierarchy
      queryFn: async () => {
        const url = genApiUrl(MODULE_NAME, 'getLore', [loreId]);
        const response = await apiClient.get<LoreResponse>(url);
        return response.data;
      },
      enabled: !!loreId,
    });

  const setRetrievalPreference = useMutation<
    LoreResponse,
    Error,
    { loreId: string; enabled: boolean; characterId: string; sessionId?: string }
  >({
    mutationFn: async ({ loreId, enabled }) => {
      const url = genApiUrl(MODULE_NAME, 'setRetrievalPreference', [loreId]);
      const response = await apiClient.put<LoreResponse>(url, { enabled });
      return response.data;
    },
    onSuccess: async (_data, variables) => {
      const invalidations = [
        queryClient.invalidateQueries({ queryKey: ['lore', 'detail', 'getLore', variables.loreId] }),
        queryClient.invalidateQueries({
          queryKey: ['lore', 'list', 'getActiveLoresByCharacter', variables.characterId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['lore', 'list', 'getEditableLoresByCharacter', variables.characterId],
        }),
      ];
      if (variables.sessionId) {
        invalidations.push(
          queryClient.invalidateQueries({ queryKey: ['lore', 'list', 'getLoresBySession', variables.sessionId] }),
        );
      }
      await Promise.all(invalidations);
    },
  });

  return {
    storeLore: storeLore.mutateAsync,
    setRetrievalPreference: setRetrievalPreference.mutateAsync,
    getActiveLoresByCharacter,
    getEditableLoresByCharacter,
    getLoresBySession,
    getLore,
  };
};
