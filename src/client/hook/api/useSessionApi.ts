// client/hooks/useSessionApi.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SessionInfo } from '#shared/domain/session/SessionInterfaces.js';
import { MODULE_NAMES } from '#shared/config/constants.js';
import { genApiUrl } from '#shared/util/apiHelpers.js';
import { SessionResponse } from '#shared/api/ModuleResponse.js';
import { apiClient } from '../../util/clientApiHelpers.ts';

/**
 * A client-side hook for interacting with the SESSION API endpoints.
 * It encapsulates API logic, loading/error states, and query caching.
 */
export const useSessionApi = () => {
	const MODULE_NAME = MODULE_NAMES.SESSION;
	const queryClient = useQueryClient();

	/**
	 * Creates a new session.
	 * This is a useMutation hook as it modifies server state.
	 */
	const createSession = useMutation<
		SessionInfo,
		Error,
		{ userId: string; characterId: string; profileId: string; firstCharMessage: string }
	>({
		mutationFn: async (variables) => {
			const url = genApiUrl(MODULE_NAME, 'createSession');
			const response = await apiClient.post<SessionInfo>(url, variables);
			return response.data;
		},
		onSuccess: (newSession) => {
			// Invalidate the query for the list of sessions to make it refetch
			// with the new session included.
			queryClient.invalidateQueries({ queryKey: ['getSessionsByUserId', newSession.userId] });
		},
	});

	/**
	 * Fetches all sessions for a given user.
	 * This is a useQuery hook as it fetches data.
	 */
	const getSessionsByUserId = (userId: string) =>
		useQuery<SessionResponse, Error>({
			queryKey: ['getSessionsByUserId', userId],
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getSessionsByUserId', [userId]);
				const response = await apiClient.get<SessionResponse>(url);
				return response.data;
			},
			enabled: !!userId,
		});

	/**
	 * Fetches all sessions for a given user.
	 * This is a useQuery hook as it fetches data.
	 */
	const getSessionsByUserIdAndCharacterId = (userId: string, characterId: string) =>
		useQuery<SessionResponse, Error>({
			queryKey: ['getSessionsByUserIdAndCharacterId', userId, characterId],
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getSessionsByUserIdAndCharacterId', [userId, characterId]);
				const response = await apiClient.get<SessionResponse>(url);
				return response.data;
			},
			enabled: !!userId && !!characterId,
		});

	/**
	 * Fetches a single session by its ID.
	 * This is a useQuery hook.
	 */
	const getSession = (sessionId: string) =>
		useQuery<SessionResponse, Error>({
			queryKey: ['getSession', sessionId],
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getSession', [sessionId]);
				const response = await apiClient.get<SessionResponse>(url);
				return response.data;
			},
			enabled: !!sessionId, // The query will only run if a sessionId is provided.
		});

	/**
	 * Updates a session after a new message.
	 * This is a useMutation hook.
	 */
	const updateSessionOnNewMessage = useMutation<
		void,
		Error,
		{ sessionId: string; latestCharMessage: string }
	>({
		mutationFn: async (variables) => {
			const url = genApiUrl(MODULE_NAME, 'updateSessionOnNewMessage');
			await apiClient.put(url, variables);
		},
		onSuccess: (_, variables) => {
			// Invalidate queries for the specific session and the session list
			// to ensure the UI reflects the updated `updatedAt` time and message snippet.
			queryClient.invalidateQueries({ queryKey: ['getSession', variables.sessionId] });
			queryClient.invalidateQueries({ queryKey: ['getSessionsByUserId'] }); // Invalidates all session lists
		},
	});

	return {
		createSession,
		getSessionsByUserId,
		getSession,
		updateSessionOnNewMessage,
		getSessionsByUserIdAndCharacterId,
	};
};
