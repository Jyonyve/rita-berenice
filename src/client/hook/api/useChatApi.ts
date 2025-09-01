// src/client/hooks/useChatApi.ts

import type { Where } from 'chromadb';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, decompressData, genApiUrl } from '../../util/clientApiHelpers.js';
import { ChatTurn } from '#shared/domain/chat/ChatInterfaces.js';
import { MODULE_NAMES } from '#shared/config/constants.js';
import { Payload } from '#shared/util/apiHelpers.js';
import { ChatResponse } from '#shared/api/ModuleResponse.js';

/**
 * A client-side hook for interacting with the CHAT and TEMP_CHAT API endpoints.
 * It encapsulates API logic, loading/error states, and user notifications via a toast system.
 */
export const useChatApi = () => {
	const queryClient = useQueryClient();

	/**
	 * Stores a finalized chat turn.
	 * Query Key: ['storeChatTurn']
	 */
	const storeChatTurn = useMutation<void, Error, ChatTurn>({
		mutationFn: async (chatTurn: ChatTurn) => {
			const url = genApiUrl(MODULE_NAMES.CHAT, 'storeChatTurn');
			await apiClient.post<ChatTurn>(url, chatTurn);
		},
		onSuccess: (data, variables) => {
			// addToast('Chat turn saved.', 'success');
			if (variables) {
				queryClient.invalidateQueries({ queryKey: ['getAllChatTurns', variables.sessionId] });
			}
		},
	});

	/**
	 * Fetches all chat turns for history loading.
	 * Uses useQuery because the API returns all data at once.
	 * Query Key: ['getAllDisplayTurns']
	 */
	const getAllDisplayTurns = (sessionId: string) =>
		useQuery<ChatResponse, Error>({
			queryKey: ['getAllDisplayTurns', sessionId], // The query key now reflects the method name
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAMES.CHAT, 'getAllDisplayTurns', [sessionId]);
				// No `beforeSequence` param if the API fetches all data at once
				const response = await apiClient.get<Payload>(url);
				return decompressData<ChatResponse>(response.data.payload);
			},
			enabled: !!sessionId, // Only run the query if sessionId is available
		});

	/**
	 * Fetches a single, specific chat turn by its sequence number.
	 * Query Key: ['getChatTurnBySequence']
	 */
	const getChatTurnBySequence = (sessionId: string, sequence: number) =>
		useQuery<ChatResponse, Error>({
			queryKey: ['getChatTurnBySequence', sessionId, sequence], // The query key now reflects the method name
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAMES.CHAT, 'getChatTurnBySequence', [sessionId, sequence]);
				const response = await apiClient.get<Payload>(url);
				return decompressData<ChatResponse>(response.data.payload);
			},
			enabled: !!sessionId && typeof sequence === 'number', // Only run if both are available
		});

	// /**
	//  * Performs a semantic search over finalized chat turns.
	//  * Uses useMutation because it's a POST request (search/query) and does not represent
	//  * a continuously available piece of data.
	//  * Query Key: ['queryChatTurns']
	//  */
	// const queryChatTurns = useMutation<
	// 	ChatResponse,
	// 	Error,
	// 	{ sessionId: string; queryTexts: string[]; where?: Where }
	// >({
	// 	mutationFn: async ({ sessionId, queryTexts, where }) => {
	// 		const url = genApiUrl(MODULE_NAMES.CHAT, 'queryChatTurns');
	// 		const response = await apiClient.post<Payload>(url, { sessionId, queryTexts, where });
	// 		return decompressData<ChatResponse>(response.data.payload);
	// 	},
	// });

	return {
		storeChatTurn: storeChatTurn.mutateAsync,
		getAllDisplayTurns,
		getChatTurnBySequence,
		// queryChatTurns
	};
};
