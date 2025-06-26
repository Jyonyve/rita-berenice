// src/client/hooks/useOrchestrationApi.ts

import { useState, useCallback } from 'react';
import {
	apiClient,
	genApiUrl,
	MODULE_NAMES,
	ApiError,
	TempChatTurn,
	TempChatTurnCdo,
	CharacterInfo,
	ProfileInfo,
	AiModelInfo,
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
	 * Orchestrates the backend flow for generating a new character response.
	 * @param tempChatTurnCdo - Contains the sessionId, sequence, and new user input.
	 * @param characterInfo - The full information object for the character who is speaking.
	 * @param profileInfo - The full information object for the user.
	 * @param aiModel - (Optional) The specific AI model to use for this generation.
	 * @returns The updated TempChatTurn object containing the new response, or null on failure.
	 */
	const handleChatRequest = useCallback(
		async (
			tempChatTurnCdo: TempChatTurnCdo,
			characterInfo: CharacterInfo,
			profileInfo: ProfileInfo,
			aiModel: AiModelInfo
		): Promise<TempChatTurn | null> => {
			setLoading(true);
			setError(null);
			try {
				const url = genApiUrl(MODULE_NAME, 'handleChatRequest');
				// Construct the request body to match the new API contract
				const response = await apiClient.post<TempChatTurn>(url, {
					tempChatTurnCdo,
					characterInfo,
					profileInfo,
					aiModel,
				});
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
