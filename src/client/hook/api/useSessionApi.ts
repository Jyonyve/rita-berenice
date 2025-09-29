import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SessionInfo } from '#shared/domain/session/session.type.js';
import { MODULE_NAMES } from '#shared/config/constants.js';
import { Payload } from '#shared/util/apiHelpers.js';
import { SessionResponse } from '#shared/api/ModuleResponse.js';
import { apiClient, decompressData, genApiUrl } from '../../util/clientApiHelpers.js';
import { useAuth } from '../../provider/index.js';

export const useSessionApi = () => {
	const MODULE_NAME = MODULE_NAMES.SESSION;
	const queryClient = useQueryClient();
	const { userId } = useAuth();

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
		onSuccess: () => {
			// Invalidate all session-related queries since a new session affects all lists
			queryClient.invalidateQueries({ queryKey: ['sessions'] });
		},
	});

	const getSessionsByUserId = (userId: string) =>
		useQuery<SessionResponse, Error>({
			queryKey: ['sessions', 'list', 'getSessionsByUserId', userId], // Hierarchical structure
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getSessionsByUserId', [userId]);
				const response = await apiClient.get<Payload>(url);
				return decompressData<SessionResponse>(response.data.payload);
			},
			enabled: !!userId,
		});

	const getSessionsByUserIdAndCharacterId = (userId: string, characterId: string) =>
		useQuery<SessionResponse, Error>({
			queryKey: ['sessions', 'list', 'getSessionsByUserIdAndCharacterId', userId, characterId], // Hierarchical structure
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getSessionsByUserIdAndCharacterId', [userId, characterId]);
				const response = await apiClient.get<Payload>(url);
				return decompressData<SessionResponse>(response.data.payload);
			},
			enabled: !!userId && !!characterId,
		});

	const getSession = (sessionId: string) =>
		useQuery<SessionResponse, Error>({
			queryKey: ['sessions', 'detail', 'getSession', sessionId], // Hierarchical structure
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getSession', [sessionId]);
				const response = await apiClient.get<Payload>(url);
				return decompressData<SessionResponse>(response.data.payload);
			},
			enabled: !!sessionId,
		});

	/**
	 * Updates session on new message. Called frequently.
	 * Now efficiently invalidates both the specific session AND related lists.
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
			// Invalidate the specific session detail
			queryClient.invalidateQueries({ queryKey: ['sessions', 'detail', variables.sessionId] });

			// Also invalidate all session lists since the "latest message" affects list ordering/preview
			queryClient.invalidateQueries({ queryKey: ['sessions', 'list', userId] });
		},
	});

	/**
	 * Updates session on new message. Called frequently.
	 * Now efficiently invalidates both the specific session AND related lists.
	 */
	const updateSessionUserNote = useMutation<void, Error, { sessionId: string; userNote: string }>({
		mutationFn: async (variables) => {
			const url = genApiUrl(MODULE_NAME, 'updateSessionUserNote');
			await apiClient.put(url, variables);
		},
		onSuccess: (_, variables) => {
			// Invalidate the specific session detail
			queryClient.invalidateQueries({ queryKey: ['sessions', 'detail', variables.sessionId] });

			// Also invalidate all session lists since the "latest message" affects list ordering/preview
			queryClient.invalidateQueries({ queryKey: ['sessions', 'list', userId] });
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
			// Invalidate the specific session and all related lists
			queryClient.invalidateQueries({ queryKey: ['sessions', 'detail', variables.sessionId] });
			queryClient.invalidateQueries({ queryKey: ['sessions', 'list', userId] });
		},
	});

	/**
	 * Updates session title. Called less frequently.
	 */
	const updateSessionTitle = useMutation<void, Error, { sessionId: string; title: string }>({
		mutationFn: async (variables) => {
			const url = genApiUrl(MODULE_NAME, 'updateSessionTitle');
			await apiClient.put(url, variables);
		},
		onSuccess: (_, variables) => {
			// Title changes affect both detail view and list previews
			queryClient.invalidateQueries({ queryKey: ['sessions', 'detail', variables.sessionId] });
			queryClient.invalidateQueries({ queryKey: ['sessions', 'list', userId] });
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
			// Full update affects everything
			queryClient.invalidateQueries({
				queryKey: ['sessions', 'detail', variables.sessionInfo.sessionId],
			});
			queryClient.invalidateQueries({ queryKey: ['sessions', 'list', userId] });
		},
	});

	return {
		createSession: createSession.mutateAsync,
		getSessionsByUserId,
		getSession,
		initSessionProfileId: initSessionProfileId.mutateAsync,
		updateSession: updateSession.mutateAsync,
		updateSessionOnNewMessage: updateSessionOnNewMessage.mutateAsync,
		updateSessionUserNote: updateSessionUserNote.mutateAsync,
		updateSessionTitle: updateSessionTitle.mutateAsync,
		getSessionsByUserIdAndCharacterId,
	};
};
