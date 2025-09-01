import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SessionInfo } from '#shared/domain/session/SessionInterfaces.js';
import { MODULE_NAMES } from '#shared/config/constants.js';
import { Payload } from '#shared/util/apiHelpers.js';
import { SessionResponse } from '#shared/api/ModuleResponse.js';
import { apiClient, decompressData, genApiUrl } from '../../util/clientApiHelpers.js';
import { parseProfileId } from '#shared/util/parseUtils.js';

export const useSessionApi = () => {
	const MODULE_NAME = MODULE_NAMES.SESSION;
	const queryClient = useQueryClient();

	/** Creates a new session */
	const createSession = useMutation<
		{ sessionId: string },
		Error,
		{ userId: string; characterId: string; firstCharMessage: string }
	>({
		mutationFn: async (variables) => {
			const url = genApiUrl(MODULE_NAME, 'createSession');
			const response = await apiClient.post<{ sessionId: string }>(url, variables);
			return response.data;
		},
		onSuccess: (data, variables) => {
			// Use Promise.all to run invalidations concurrently for optimal performance
			Promise.all([
				queryClient.invalidateQueries({ queryKey: ['getSessionsByUserId', variables.userId] }),
				queryClient.invalidateQueries({ queryKey: ['getSession', data.sessionId] }),
				queryClient.invalidateQueries({
					queryKey: ['getSessionsByUserIdAndCharacterId', variables.userId, variables.characterId],
				}),
			]);
		},
	});

	const getSessionsByUserId = (userId: string) =>
		useQuery<SessionResponse, Error>({
			queryKey: ['getSessionsByUserId', userId],
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getSessionsByUserId', [userId]);
				const response = await apiClient.get<Payload>(url);
				return decompressData<SessionResponse>(response.data.payload);
			},
			enabled: !!userId,
		});

	const getSessionsByUserIdAndCharacterId = (userId: string, characterId: string) =>
		useQuery<SessionResponse, Error>({
			queryKey: ['getSessionsByUserIdAndCharacterId', userId, characterId],
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getSessionsByUserIdAndCharacterId', [userId, characterId]);
				const response = await apiClient.get<Payload>(url);
				return decompressData<SessionResponse>(response.data.payload);
			},
			enabled: !!userId && !!characterId,
		});

	const getSession = (sessionId: string) =>
		useQuery<SessionResponse, Error>({
			queryKey: ['getSession', sessionId],
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getSession', [sessionId]);
				const response = await apiClient.get<Payload>(url);
				return decompressData<SessionResponse>(response.data.payload);
			},
			enabled: !!sessionId,
		});

	/**
	 * Updates session on new message. Called frequently.
	 * Only invalidates the specific session to avoid excessive refetching of lists.
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
			// Only invalidate the specific session. This is a performance-critical optimization.
			queryClient.invalidateQueries({ queryKey: ['getSession', variables.sessionId] });
		},
	});

	/**
	 * Links a profileId to a session after creation.
	 */
	const initSessionProfileId = useMutation<void, Error, { sessionId: string; profileId: string }>({
		mutationFn: async (variables) => {
			const url = genApiUrl(MODULE_NAME, 'initSessionProfileId');
			await apiClient.put(url, variables);
		},
		onSuccess: (_, variables) => {
			const { userId } = parseProfileId(variables.profileId);
			// Use Promise.all for consistency and correctness
			Promise.all([
				queryClient.invalidateQueries({ queryKey: ['getSession', variables.sessionId] }),
				queryClient.invalidateQueries({ queryKey: ['getSessionsByUserId', userId] }),
			]);
		},
	});

	/**
	 * Performs a full update of a session's editable info.
	 */
	const updateSession = useMutation<void, Error, { sessionInfo: SessionInfo }>({
		mutationFn: async (variables) => {
			const url = genApiUrl(MODULE_NAME, 'updateSession');
			await apiClient.put(url, variables);
		},
		onSuccess: (_, variables) => {
			// Use Promise.all for consistency and correctness
			Promise.all([
				queryClient.invalidateQueries({ queryKey: ['getSession', variables.sessionInfo.sessionId] }),
				queryClient.invalidateQueries({
					queryKey: ['getSessionsByUserId', variables.sessionInfo.userId],
				}),
			]);
		},
	});

	return {
		createSession: createSession.mutateAsync,
		getSessionsByUserId,
		getSession,
		initSessionProfileId: initSessionProfileId.mutateAsync,
		updateSession: updateSession.mutateAsync,
		updateSessionOnNewMessage: updateSessionOnNewMessage.mutateAsync,
		getSessionsByUserIdAndCharacterId,
	};
};
