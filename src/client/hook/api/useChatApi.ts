// src/client/hooks/useChatApi.ts

import { useState, useCallback } from 'react';
import {
	apiClient,
	genApiUrl,
	MODULE_NAMES,
	ApiError,
	ChatResponse,
	ChatTurn,
	TempChatTurn,
} from '#shared/index.ts';
import { Where } from 'chromadb'; // Assuming these types are available on the client
import { useToast } from '../../style/index.ts';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const queryClient = useQueryClient();

/**
 * A client-side hook for interacting with the CHAT and TEMP_CHAT API endpoints.
 * It encapsulates API logic, loading/error states, and user notifications via a toast system.
 */
export const useChatApi = () => {
	const { addToast } = useToast();

	/**
	 * Stores a finalized chat turn.
	 * Query Key: ['storeChatTurn']
	 */
	const storeChatTurn = useMutation<ChatTurn, ApiError, ChatTurn>({
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
		onError: (error: ApiError) => {
			addToast(error.clientMessage || 'Failed to save Chat Turn.', 'error');
		},
	});

	/**
	 * Fetches all chat turns for history loading.
	 * Uses useQuery because the API returns all data at once.
	 * Query Key: ['getChatTurns']
	 */
	const getAllChatTurns = (sessionId: string) =>
		useQuery<ChatResponse, ApiError>({
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
	 * Fetches a list of chat turns for history loading.
	 * @param sessionId The session ID.
	 * @param beforeSequence Fetches turns with a sequence number less than this value.
	 * @returns A ChatResponse object, or null on failure.
	 */
	// const getChatTurns = useCallback(
	// 	async (sessionId: string, beforeSequence: number): Promise<ChatResponse> => {
	// 		setLoading(true);
	// 		setError(null);
	// 		try {
	// 			const url = genApiUrl(MODULE_NAMES.CHAT, 'getChatTurns', [sessionId]);
	// 			const response = await apiClient.get<ChatResponse>(url, { params: { beforeSequence } });
	// 			return response.data;
	// 		} catch (err) {
	// 			const apiError = err as ApiError;
	// 			addToast(apiError.clientMessage || 'Failed to load chat history.', 'error');
	// 			setError(apiError);
	// 			return null;
	// 		} finally {
	// 			setLoading(false);
	// 		}
	// 	},
	// 	[addToast]
	// );

	/**
	 * Fetches a single, specific chat turn by its sequence number.
	 * Query Key: ['getChatTurnBySequence']
	 */
	const getChatTurnBySequence = (sessionId: string, sequence: number) =>
		useQuery<ChatResponse, ApiError>({
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
		ApiError,
		{ sessionId: string; queryTexts: string[]; where?: Where }
	>({
		mutationFn: async ({ sessionId, queryTexts, where }) => {
			const url = genApiUrl(MODULE_NAMES.CHAT, 'queryChatTurns');
			const response = await apiClient.post<ChatResponse>(url, { sessionId, queryTexts, where });
			return response.data;
		},
	});

	// --- Temporary Chat Turn Operations ---

	/**
	 * Saves a temporary chat turn object.
	 * Query Key: ['saveTempChatTurn']
	 */
	const saveTempChatTurn = useMutation<boolean, ApiError, TempChatTurn>({
		mutationFn: async (tempData: TempChatTurn) => {
			const url = genApiUrl(MODULE_NAMES.TEMP, 'saveTempChatTurn');
			await apiClient.post(url, tempData);
			return true;
		},
		onError: (error: ApiError) => {
			addToast(error.clientMessage || 'Failed to save Temp Turn.', 'error');
		},
	});

	/**
	 * Fetches a temporary chat turn.
	 * Query Key: ['getTempChatTurn']
	 */
	const getTempChatTurn = (sessionId: string, sequence: number) =>
		useQuery<TempChatTurn, ApiError>({
			queryKey: ['getTempChatTurn', sessionId, sequence], // The query key now reflects the method name
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAMES.TEMP, 'getTempChatTurn', [sessionId, sequence]);
				const response = await apiClient.get<TempChatTurn>(url);
				return response.data;
			},
			enabled: !!sessionId && typeof sequence === 'number', // Only run if both are available
			retry: (failureCount, error) => (error.status === 404 ? false : failureCount < 3),
		});

	return {
		storeChatTurn,
		getAllChatTurns,
		// getChatTurns,
		getChatTurnBySequence,
		queryChatTurns,
		saveTempChatTurn,
		getTempChatTurn,
	};
};
