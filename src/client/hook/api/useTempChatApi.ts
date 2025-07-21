// src/client/hooks/useTempChatApi.ts

import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../../util/clientApiHelpers.js';
import { TempChatTurn } from '#shared/domain/chat/ChatInterfaces.js';
import { MODULE_NAMES } from '#shared/config/constants.js';
import { genApiUrl } from '#shared/util/apiHelpers.js';
import { ChatResponse, TempChatResponse } from '#shared/api/ModuleResponse.js';

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
	const getTempChatTurn = (sessionId: string, sequence: number) =>
		useQuery<TempChatResponse, Error>({
			queryKey: ['getTempChatTurn', sessionId, sequence], // The query key now reflects the method name
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAMES.TEMP, 'getTempChatTurn', [sessionId, sequence]);
				const response = await apiClient.get<TempChatResponse>(url);
				return response.data;
			},
			enabled: !!sessionId && typeof sequence === 'number', // Only run if both are available
			retry: (failureCount, error) => (error.name === '404' ? false : failureCount < 3),
		});

	const getLastTempTurnsForSessions = (sessionIds: string[]) =>
		useQuery<TempChatResponse, Error>({
			queryKey: ['getLastTempTurnsForSessions', sessionIds],
			queryFn: async () => {
				// Prevent making an API call with no session IDs.
				// Construct the URL. The sessionIds array is joined into a comma-separated string
				// to be passed as a single query parameter.
				const url = `${genApiUrl(
					MODULE_NAMES.TEMP,
					'getLastTempTurnsForSessions'
				)}?sessionIds=${sessionIds.join(',')}`;

				const response = await apiClient.get<TempChatResponse>(url);
				return response.data;
			},
			enabled: !!sessionIds && sessionIds.length > 0,
			// Optional: Refetch data periodically for a "live" session list.
			// refetchInterval: 30000, // e.g., every 30 seconds
		});

	return { saveTempChatTurn, getTempChatTurn, getLastTempTurnsForSessions };
};
