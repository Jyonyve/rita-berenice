// src/client/hooks/useMemoryApi.ts

import { useMutation } from '@tanstack/react-query';
import { genApiUrl } from '#shared/util/apiHelpers.js';

import { apiClient } from '../../util/clientHelpers.js';
import { MODULE_NAMES } from '#shared/config/constants.js';
import { MemoryResponse } from '#shared/api/ModuleResponse.js';
import { ChatTurn, ChatTurnMetadata } from '#shared/domain/chat/ChatInterfaces.js';

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
		Error,
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
	const enrichChatTurnMetadataViaLlm = useMutation<ChatTurnMetadata | null, Error, ChatTurn>({
		mutationFn: async (turn) => {
			const url = genApiUrl(MODULE_NAME, 'enrichChatTurnMetadataViaLlm');
			const response = await apiClient.post<ChatTurnMetadata>(url, turn);
			return response.data;
		},
	});

	return { recallRelevantMemories, enrichChatTurnMetadataViaLlm };
};
