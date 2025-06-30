// src/client/hooks/useOrchestrationApi.ts

import {
	apiClient,
	genApiUrl,
	MODULE_NAMES,
	TempChatTurn,
	TempChatTurnCdo,
	CharacterInfo,
	ProfileInfo,
	AiModelInfo,
	ChatTurn,
	ChatTurnCdo,
} from '@shared/index.ts';
import { useToast } from '../../style/ToastProvider.tsx';
import { useMutation } from '@tanstack/react-query';
import { ApiError } from '#server/util/serviceHelpers.ts';

/**
 * A client-side hook for interacting with the main ORCHESTRATION API endpoint,
 * refactored for TanStack Query.
 */
export const useOrchestrationApi = () => {
	const MODULE_NAME = MODULE_NAMES.ORCHESTRATION;
	const { addToast } = useToast();

	/**
	 * Finalizes a turn by enriching it and saving it to the permanent CHAT collection.
	 * This is separate from generating a new response.
	 */
	const finalizeChatTurn = useMutation<ChatTurn, ApiError, ChatTurnCdo>({
		mutationFn: async (cdo: ChatTurnCdo) => {
			const url = genApiUrl(MODULE_NAMES.ORCHESTRATION, 'finalizeChatTurn');
			const response = await apiClient.post<ChatTurn>(url, cdo);
			return response.data;
		},
		// No toast on success for this background task
		onError: (error: ApiError) => {
			addToast(error.clientMessage || 'Failed to save previous turn.', 'error');
			// Error is handled globally and in the calling function's catch block
		},
	});

	/**
	 * Orchestrates the backend flow for generating a new character response.
	 * This is a mutation as it creates a new chat turn (even temporary).
	 * Mutation key: 'receiveBotResponse'
	 */
	const receiveBotResponse = useMutation<
		TempChatTurn, // Return type on success
		ApiError, // Error type
		{
			tempChatTurnCdo: TempChatTurnCdo;
			characterInfo: CharacterInfo;
			profileInfo: ProfileInfo;
			aiModelInfo: AiModelInfo;
		} // Variables type
	>({
		mutationFn: async ({ tempChatTurnCdo, characterInfo, profileInfo, aiModelInfo }) => {
			const url = genApiUrl(MODULE_NAME, 'receiveBotResponse');
			const response = await apiClient.post<TempChatTurn>(url, {
				tempChatTurnCdo,
				characterInfo,
				profileInfo,
				aiModelInfo,
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

	return { receiveBotResponse, finalizeChatTurn };
};
