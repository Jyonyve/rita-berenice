// src/client/hooks/useMemoryApi.ts

import {
	apiClient,
	genApiUrl,
	MODULE_NAMES,
	ApiError,
	MemoryResponse,
	ChatTurn,
	ChatTurnMetadata,
} from '#shared/index.ts';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '../../style/ToastProvider.tsx';

/**
 * A client-side hook for interacting with the MEMORY API endpoints, refactored for TanStack Query.
 * Both operations are mutations since they involve sending data and receiving computed results.
 */
export const useMemoryApi = () => {
	const MODULE_NAME = MODULE_NAMES.MEMORY;
	const { addToast } = useToast();

	/**
	 * Gathers all relevant context (memories) for generating a coherent response.
	 * Mutation key: 'recallRelevantMemories'
	 */
	const recallRelevantMemories = useMutation<
		MemoryResponse | null,
		ApiError,
		{ sessionId: string; userRequestText: string }
	>({
		mutationFn: async ({ sessionId, userRequestText }) => {
			const url = genApiUrl(MODULE_NAME, 'recallRelevantMemories');
			const response = await apiClient.post<MemoryResponse>(url, { sessionId, userRequestText });
			return response.data;
		},
		onError: (error: ApiError) => {
			addToast(error.clientMessage || 'Failed to recall memories.', 'error');
		},
	});

	/**
	 * Enriches a chat turn with LLM-generated metadata.
	 * Mutation key: 'enrichChatTurnMetadataViaLlm'
	 */
	const enrichChatTurnMetadataViaLlm = useMutation<ChatTurnMetadata | null, ApiError, ChatTurn>({
		mutationFn: async (turn) => {
			const url = genApiUrl(MODULE_NAME, 'enrichChatTurnMetadataViaLlm');
			const response = await apiClient.post<ChatTurnMetadata>(url, turn);
			return response.data;
		},
		onSuccess: () => {
			addToast('Chat turn metadata enriched.', 'success');
		},
		onError: (error: ApiError) => {
			addToast(error.clientMessage || 'Failed to enrich chat turn metadata.', 'error');
		},
	});

	return { recallRelevantMemories, enrichChatTurnMetadataViaLlm };
};
