// src/client/hooks/useChatApi.ts

import type { Where } from 'chromadb';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../util/clientHelpers.js';
import { ChatTurn, TempChatTurn } from '#shared/domain/chat/ChatInterfaces.js';
import { MODULE_NAMES } from '#shared/config/constants.js';
import { genApiUrl } from '#shared/util/apiHelpers.js';
import { ChatResponse, TempChatResponse } from '#shared/api/ModuleResponse.js';

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
	const storeChatTurn = useMutation<ChatTurn, Error, ChatTurn>({
		mutationFn: async (chatTurn: ChatTurn) => {
			const url = genApiUrl(MODULE_NAMES.CHAT, 'storeChatTurn');
			const response = await apiClient.post<ChatTurn>(url, chatTurn);
			return response.data;
		},
		onSuccess: (data) => {
			// addToast('Chat turn saved.', 'success');
			if (data) {
				queryClient.invalidateQueries({ queryKey: ['getChatTurns', data.sessionId] });
				queryClient.setQueryData(['getChatTurnBySequence', data.sessionId, data.sequence], data);
			}
		},
	});

	/**
	 * Fetches all chat turns for history loading.
	 * Uses useQuery because the API returns all data at once.
	 * Query Key: ['getChatTurns']
	 */
	const getAllChatTurns = (sessionId: string) =>
		useQuery<ChatResponse, Error>({
			queryKey: ['getAllChatTurns', sessionId], // The query key now reflects the method name
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAMES.CHAT, 'getAllChatTurns', [sessionId]);
				// No `beforeSequence` param if the API fetches all data at once
				const response = await apiClient.get<ChatResponse>(url);
				return response.data;
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
				const response = await apiClient.get<ChatResponse>(url);
				return response.data;
			},
			enabled: !!sessionId && typeof sequence === 'number', // Only run if both are available
		});

	/**
	 * Performs a semantic search over finalized chat turns.
	 * Uses useMutation because it's a POST request (search/query) and does not represent
	 * a continuously available piece of data.
	 * Query Key: ['queryChatTurns']
	 */
	const queryChatTurns = useMutation<
		ChatResponse,
		Error,
		{ sessionId: string; queryTexts: string[]; where?: Where }
	>({
		mutationFn: async ({ sessionId, queryTexts, where }) => {
			const url = genApiUrl(MODULE_NAMES.CHAT, 'queryChatTurns');
			const response = await apiClient.post<ChatResponse>(url, { sessionId, queryTexts, where });
			return response.data;
		},
	});

	return { storeChatTurn, getAllChatTurns, getChatTurnBySequence, queryChatTurns };
};
