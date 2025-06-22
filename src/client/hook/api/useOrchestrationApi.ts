// src/client/hooks/useOrchestrationApi.ts

import { useState, useCallback } from 'react';
import {
	apiClient,
	genApiUrl,
	MODULE_NAMES,
	ApiError,
	TempChatTurn,
	TempChatTurnCdo,
} from '#shared/index.ts';
import { useToast } from '../../component/index.ts';

/**
 * A client-side hook for interacting with the main ORCHESTRATION API endpoint.
 * This hook is the primary entry point for generating a character response.
 */
export const useOrchestrationApi = () => {
	const MODULE_NAME = MODULE_NAMES.ORCHESTRATION;
	// --- Hooks ---
	const [loading, setLoading] = useState<boolean>(false);
	const [error, setError] = useState<ApiError | null>(null);
	const { addToast } = useToast();

	/**
	 * Orchestrates the entire backend flow for generating a new character response
	 * for a given user input.
	 * @param tempChatTurnCdo - Contains the sessionId, sequence, and new user input.
	 * @returns The updated TempChatTurn object containing the new response, or null on failure.
	 */
	const handleChatRequest = useCallback(
		async (tempChatTurnCdo: TempChatTurnCdo): Promise<TempChatTurn | null> => {
			setLoading(true);
			setError(null);
			try {
				const url = genApiUrl(MODULE_NAME, 'handleChatRequest');
				const response = await apiClient.post<TempChatTurn>(url, tempChatTurnCdo);
				// This is a core function, so a success toast is generally not needed
				// unless you want to explicitly notify the user that a response has arrived.
				return response.data;
			} catch (err) {
				const apiError = err as ApiError;
				addToast(
					apiError.clientMessage || 'An unexpected error occurred while getting a response.',
					'error'
				);
				setError(apiError);
				return null;
			} finally {
				setLoading(false);
			}
		},
		[addToast]
	);

	return { loading, error, handleChatRequest };
};
