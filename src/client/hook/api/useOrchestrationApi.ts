// src/client/hooks/useOrchestrationApi.ts

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
import { useToast } from '../../style/ToastProvider.tsx';
import { useMutation } from '@tanstack/react-query';

/**
 * A client-side hook for interacting with the main ORCHESTRATION API endpoint,
 * refactored for TanStack Query.
 */
export const useOrchestrationApi = () => {
	const MODULE_NAME = MODULE_NAMES.ORCHESTRATION;
	const { addToast } = useToast();

	/**
	 * Orchestrates the backend flow for generating a new character response.
	 * This is a mutation as it creates a new chat turn (even temporary).
	 * Mutation key: 'handleChatRequest'
	 */
	const handleChatRequest = useMutation<
		TempChatTurn, // Return type on success
		ApiError, // Error type
		{
			tempChatTurnCdo: TempChatTurnCdo;
			characterInfo: CharacterInfo;
			profileInfo: ProfileInfo;
			aiModel: AiModelInfo;
		} // Variables type
	>({
		mutationFn: async ({ tempChatTurnCdo, characterInfo, profileInfo, aiModel }) => {
			const url = genApiUrl(MODULE_NAME, 'handleChatRequest');
			const response = await apiClient.post<TempChatTurn>(url, {
				tempChatTurnCdo,
				characterInfo,
				profileInfo,
				aiModel,
			});
			return response.data;
		},
		onError: (error: ApiError) => {
			addToast(
				error.clientMessage || 'An unexpected error occurred while getting a response.',
				'error'
			);
		},
	});

	return { handleChatRequest };
};
