import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiRequestConfig, apiClient, genApiUrl } from '../../util/clientApiHelpers.js';
import { TempChatResponse } from '@rita-berenice/shared/api';
import { MODULE_NAMES } from '@rita-berenice/shared/config';
import { TempChatTurn } from '@rita-berenice/shared/domain';

/**
 * A client-side hook for interacting with the TEMP_CHAT API endpoints.
 */
export const useTempChatApi = () => {
  const queryClient = useQueryClient();

  /**
   * Saves a temporary chat turn object.
   * REFACTORED: Now expects an object { tempTurnId: string } from the server.
   */
  const saveTempChatTurn = useMutation<{ tempTurnId: string }, Error, TempChatTurn>({
    mutationFn: async (tempData) => {
      const url = genApiUrl(MODULE_NAMES.TEMP, 'saveTempChatTurn');
      const response = await apiClient.post<{ tempTurnId: string }>(url, tempData);
      return response.data;
    },
    onSuccess: (data, variables) => {
      // Invalidate the specific temp chat turn that was saved
      queryClient.invalidateQueries({
        queryKey: [
          'tempChat',
          'detail',
          'getTempChatTurn',
          variables.sessionId,
          variables.sequence,
          variables.setCount,
        ],
      });
    },
  });

  /**
   * Fetches a temporary chat turn.
   */
  /**
   * Fetches a temporary chat turn.
   */
  const getTempChatTurn = (sessionId: string, sequence: number) =>
    useQuery<TempChatResponse, Error>({
      queryKey: ['tempChat', 'detail', 'getTempChatTurn', sessionId, sequence],
      queryFn: async () => {
        const url = genApiUrl(MODULE_NAMES.TEMP, 'getTempChatTurn', [sessionId, sequence]);
        const requestConfig: ApiRequestConfig = { _suppressToast: true, _suppress404Error: true };
        const response = await apiClient.get<TempChatResponse>(url, requestConfig);
        return response.data;
      },
      enabled: !!sessionId && sequence >= 0,
      retry: false,
    });

  /**
   * Deletes a temporary chat turn (and all of its candidate response sets).
   */
  const deleteTempChatTurn = useMutation<void, Error, { sessionId: string; sequence: number }>({
    mutationFn: async ({ sessionId, sequence }) => {
      const url = genApiUrl(MODULE_NAMES.TEMP, 'deleteTempChatTurn', [sessionId, sequence]);
      await apiClient.delete(url);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['tempChat', 'detail', 'getTempChatTurn', variables.sessionId, variables.sequence],
      });
    },
  });

  return {
    saveTempChatTurn: saveTempChatTurn.mutateAsync,
    getTempChatTurn,
    deleteTempChatTurn: deleteTempChatTurn.mutateAsync,
  };
};
