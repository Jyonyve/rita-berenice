// src/client/hooks/useTempChatApi.ts

import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient, decompressData, genApiUrl } from '../../util/clientApiHelpers.js';
import { TempChatTurn } from '#shared/domain/chat/ChatInterfaces.js';
import { MODULE_NAMES } from '#shared/config/constants.js';
import { Payload } from '#shared/util/apiHelpers.js';
import { ChatResponse, TempChatResponse } from '#shared/api/ModuleResponse.js';
import { ApiError } from '#shared/domain/error/errors.js';

/**
 * A client-side hook for interacting with the CHAT and TEMP_CHAT API endpoints.
 * It encapsulates API logic, loading/error states, and user notifications via a toast system.
 */
export const useTempChatApi = () => {
	// --- Temporary Chat Turn Operations ---

	/**
	 * Saves a temporary chat turn object.
	 * Query Key: ['saveTempChatTurn']
	 */
	const saveTempChatTurn = useMutation<void, Error, TempChatTurn>({
		mutationFn: async (tempData: TempChatTurn) => {
			const url = genApiUrl(MODULE_NAMES.TEMP, 'saveTempChatTurn');
			await apiClient.post(url, tempData);
		},
	});

	/**
	 * Fetches a temporary chat turn.
	 * Query Key: ['getTempChatTurn']
	 */
	const getTempChatTurn = (sessionId: string, sequence: number, isHistoryLoading: boolean) =>
		useQuery<TempChatResponse, Error>({
			queryKey: ['getTempChatTurn', sessionId, sequence], // The query key now reflects the method name
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAMES.TEMP, 'getTempChatTurn', [sessionId, sequence]);
				const response = await apiClient.get<Payload>(url, {
					_suppressToast: true, // This flag is still useful
					_suppress404Error: true, // NEW: This will prevent console logs for 404s
				});
				return decompressData<TempChatResponse>(response.data.payload);
			},
			enabled: !isHistoryLoading && !!sessionId && sequence >= 0, // Only run if both are available
			retry: (failureCount, error) => {
				// First, check if the error is an instance of ApiError.
				if (error instanceof ApiError && error.status === 404) {
					return false; // Do not retry on a 404
				}
				// For all other errors, or if it's not an ApiError, allow one retry.
				return failureCount < 1;
			},
		});

	return { saveTempChatTurn, getTempChatTurn };
};
