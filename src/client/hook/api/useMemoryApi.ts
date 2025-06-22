// src/client/hooks/useMemoryApi.ts

import { useState, useCallback } from 'react';
import {
	apiClient,
	genApiUrl,
	MODULE_NAMES,
	ApiError,
	MemoryResponse,
	ChatTurn,
	ChatTurnMetadata,
} from '#shared/index.ts';
import { useToast } from '../../component/index.ts';

/**
 * A client-side hook for interacting with the MEMORY API endpoints.
 * It encapsulates API logic, loading/error states, and user notifications via a toast system.
 */
export const useMemoryApi = () => {
	const MODULE_NAME = MODULE_NAMES.MEMORY; // Assuming 'MEMORY' is the module name for memoryEngine routes

	// --- Hooks ---
	const [loading, setLoading] = useState<boolean>(false);
	const [error, setError] = useState<ApiError | null>(null);
	const { addToast } = useToast();

	/**
	 * Gathers all relevant context (memories) for generating a coherent response.
	 * @param sessionId The current session ID.
	 * @param userRequestText The text from the user's latest prompt for semantic search.
	 * @returns A MemoryResponse object, or null on failure.
	 */
	const recallRelevantMemories = useCallback(
		async (sessionId: string, userRequestText: string): Promise<MemoryResponse | null> => {
			setLoading(true);
			setError(null);
			try {
				const url = genApiUrl(MODULE_NAMES.MEMORY, 'recallRelevantMemories');
				const response = await apiClient.post<MemoryResponse>(url, { sessionId, userRequestText });
				return response.data;
			} catch (err) {
				const apiError = err as ApiError;
				addToast(apiError.clientMessage || 'Failed to recall memories.', 'error');
				setError(apiError);
				return null;
			} finally {
				setLoading(false);
			}
		},
		[addToast]
	);

	/**
	 * Enriches a chat turn with LLM-generated metadata.
	 * @param turn The ChatTurn object to enrich.
	 * @returns The enriched ChatTurnMetadata object, or null on failure.
	 */
	const enrichChatTurnMetadataViaLlm = useCallback(
		async (turn: ChatTurn): Promise<ChatTurnMetadata | null> => {
			setLoading(true);
			setError(null);
			try {
				const url = genApiUrl(MODULE_NAMES.MEMORY, 'enrichChatTurnMetadataViaLlm');
				const response = await apiClient.post<ChatTurnMetadata>(url, turn);
				addToast('Chat turn metadata enriched.', 'success'); // Success toast for this background process
				return response.data;
			} catch (err) {
				const apiError = err as ApiError;
				addToast(apiError.clientMessage || 'Failed to enrich chat turn metadata.', 'error');
				setError(apiError);
				return null;
			} finally {
				setLoading(false);
			}
		},
		[addToast]
	);

	return { loading, error, recallRelevantMemories, enrichChatTurnMetadataViaLlm };
};
