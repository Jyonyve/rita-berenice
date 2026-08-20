// src/client/hooks/useChatApi.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, genApiUrl } from '../../util/clientApiHelpers.js';
import { ChatTurn } from '@rita-berenice/shared/domain';
import { ChatResponse } from '@rita-berenice/shared/api';
import { MODULE_NAMES } from '@rita-berenice/shared/config';

/**
 * A client-side hook for interacting with the CHAT and TEMP_CHAT API endpoints.
 * It encapsulates API logic, loading/error states, and user notifications via a toast system.
 */
export const useChatApi = () => {
	const queryClient = useQueryClient();

	/**
	 * Stores a finalized chat turn.
	 */
	const storeChatTurn = useMutation<void, Error, ChatTurn>({
		mutationFn: async (chatTurn: ChatTurn) => {
			const url = genApiUrl(MODULE_NAMES.CHAT, 'storeChatTurn');
			await apiClient.post<ChatTurn>(url, chatTurn);
		},
		onSuccess: (data, variables) => {
			// addToast('Chat turn saved.', 'success');
			if (variables) {
				// Invalidate the specific chat turn that was stored
				queryClient.invalidateQueries({
					queryKey: ['chat', 'detail', 'getChatTurnBySequence', variables.sessionId, variables.sequence],
				});

				// Invalidate all chat lists for this session since a new turn was added
				queryClient.invalidateQueries({
					queryKey: ['chat', 'list', 'getAllDisplayTurns', variables.sessionId],
				});
			}
		},
	});

	/**
	 * Fetches all chat turns for history loading.
	 * Uses useQuery because the API returns all data at once.
	 */
	const getAllDisplayTurns = (sessionId: string) =>
		useQuery<ChatResponse, Error>({
			queryKey: ['chat', 'list', 'getAllDisplayTurns', sessionId], // Hierarchical structure
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAMES.CHAT, 'getAllDisplayTurns', [sessionId]);
				const response = await apiClient.get<ChatResponse>(url);
				return response.data;
			},
			enabled: !!sessionId, // Only run the query if sessionId is available
		});

	/**
	 * Fetches a single, specific chat turn by its sequence number.
	 */
	const getChatTurnBySequence = (sessionId: string, sequence: number) =>
		useQuery<ChatResponse, Error>({
			queryKey: ['chat', 'detail', 'getChatTurnBySequence', sessionId, sequence], // Hierarchical structure
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAMES.CHAT, 'getChatTurnBySequence', [sessionId, sequence]);
				const response = await apiClient.get<ChatResponse>(url);
				return response.data;
			},
			enabled: !!sessionId && typeof sequence === 'number', // Only run if both are available
		});

	/**
	 * Edits an already-finalized turn's request and/or response content in place.
	 */
	const updateChatTurn = useMutation<
		{ chatTurnId: string },
		Error,
		{
			sessionId: string;
			sequence: number;
			request?: ChatTurn['request'];
			response?: ChatTurn['response'];
		}
	>({
		mutationFn: async ({ sessionId, sequence, request, response }) => {
			const url = genApiUrl(MODULE_NAMES.CHAT, 'updateChatTurn', [sessionId, sequence]);
			const apiResponse = await apiClient.patch<{ chatTurnId: string }>(url, { request, response });
			return apiResponse.data;
		},
		onSuccess: (data, variables) => {
			queryClient.invalidateQueries({
				queryKey: ['chat', 'detail', 'getChatTurnBySequence', variables.sessionId, variables.sequence],
			});
			queryClient.invalidateQueries({
				queryKey: ['chat', 'list', 'getAllDisplayTurns', variables.sessionId],
			});
		},
	});

	/**
	 * Deletes the turn at the given sequence and every turn after it in the session
	 * (tail truncation, not renumbering).
	 */
	const deleteChatTurnsFromSequence = useMutation<
		{ deletedCount: number },
		Error,
		{ sessionId: string; sequence: number }
	>({
		mutationFn: async ({ sessionId, sequence }) => {
			const url = genApiUrl(MODULE_NAMES.CHAT, 'deleteChatTurnsFromSequence', [sessionId, sequence]);
			const response = await apiClient.delete<{ deletedCount: number }>(url);
			return response.data;
		},
		onSuccess: (data, variables) => {
			queryClient.invalidateQueries({
				queryKey: ['chat', 'list', 'getAllDisplayTurns', variables.sessionId],
			});
		},
	});

	// /**
	//  * Performs a semantic search over finalized chat turns.
	//  * Uses useMutation because it's a POST request (search/query) and does not represent
	//  * a continuously available piece of data.
	//  */
	// const queryChatTurns = useMutation<
	//     ChatResponse,
	//     Error,
	//     { sessionId: string; queryTexts: string[]; where?: Where }
	// >({
	//     mutationFn: async ({ sessionId, queryTexts, where }) => {
	//         const url = genApiUrl(MODULE_NAMES.CHAT, 'queryChatTurns');
	//         const response = await apiClient.post<ChatResponse>(url, { sessionId, queryTexts, where });
	//         return response.data;
	//     },
	// });

	return {
		storeChatTurn: storeChatTurn.mutateAsync,
		updateChatTurn: updateChatTurn.mutateAsync,
		deleteChatTurnsFromSequence: deleteChatTurnsFromSequence.mutateAsync,
		getAllDisplayTurns,
		getChatTurnBySequence,
		// queryChatTurns
	};
};
