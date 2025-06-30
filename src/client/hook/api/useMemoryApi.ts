// src/client/hooks/useMemoryApi.ts

import {
	genApiUrl,
	MODULE_NAMES,
	MemoryResponse,
	ChatTurn,
	ChatTurnMetadata,
} from '#shared/index.js';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '../../style/ToastProvider.jsx';
import { ApiError } from '#server/util/serviceHelpers.js';
import { apiClient } from '../../util/index.js';

/**
 * A client-side hook for interacting with the MEMORY API endpoints, refactored for TanStack Query.
 * Both operations are mutations since they involve sending data and receiving computed results.
 */
export const useMemoryApi = () => {
	const MODULE_NAME = MODULE_NAMES.MEMORY;

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
	});

	return { recallRelevantMemories, enrichChatTurnMetadataViaLlm };
};
