import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, decompressData, genApiUrl } from '../../util/clientApiHelpers.js';
import { TempChatTurn } from '@rita-berenice/shared/domain/chat/chat.type.js';
import { MODULE_NAMES } from '@rita-berenice/shared/config/constants.js';
import { Payload } from '@rita-berenice/shared/util/apiHelpers.js';
import { TempChatResponse } from '@rita-berenice/shared/api/ModuleResponse.js';

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
				const response = await apiClient.get<Payload>(url, {
					_suppressToast: true,
					_suppress404Error: true,
				});
				return decompressData<TempChatResponse>(response.data.payload);
			},
			enabled: !!sessionId && sequence >= 0,
			retry: false,
		});

	return { saveTempChatTurn: saveTempChatTurn.mutateAsync, getTempChatTurn };
};
