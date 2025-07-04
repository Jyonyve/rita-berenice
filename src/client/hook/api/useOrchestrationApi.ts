// src/client/hooks/useOrchestrationApi.ts

import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../../util/clientHelpers.js';
import { MODULE_NAMES } from '#shared/config/constants.js';
import {
	ChatTurn,
	ChatTurnCdo,
	TempChatTurn,
	TempChatTurnCdo,
} from '#shared/domain/chat/ChatInterfaces.js';
import { genApiUrl } from '#shared/util/apiHelpers.js';
import { CharacterInfo } from '#shared/domain/character/CharacterInterfaces.js';
import { AiModelInfo } from '#shared/domain/aimodel/AiInfoTypes.js';
import { ProfileInfo } from '#shared/domain/profile/ProfileInterfaces.js';

/**
 * A client-side hook for interacting with the main ORCHESTRATION API endpoint,
 * refactored for TanStack Query.
 */
export const useOrchestrationApi = () => {
	const MODULE_NAME = MODULE_NAMES.ORCHESTRATION;

	/**
	 * Finalizes a turn by enriching it and saving it to the permanent CHAT collection.
	 * This is separate from generating a new response.
	 */
	const finalizeChatTurn = useMutation<ChatTurn, Error, ChatTurnCdo>({
		mutationFn: async (cdo: ChatTurnCdo) => {
			const url = genApiUrl(MODULE_NAMES.ORCHESTRATION, 'finalizeChatTurn');
			const response = await apiClient.post<ChatTurn>(url, cdo);
			return response.data;
		},
	});

	/**
	 * Orchestrates the backend flow for generating a new character response.
	 * This is a mutation as it creates a new chat turn (even temporary).
	 * Mutation key: 'receiveBotResponse'
	 */
	const receiveBotResponse = useMutation<
		TempChatTurn, // Return type on success
		Error, // Error type
		{
			tempChatTurnCdo: TempChatTurnCdo;
			characterInfo: CharacterInfo;
			profileInfo: ProfileInfo;
			aiModelInfo: AiModelInfo;
			recentChatTurnString: string;
		} // Variables type
	>({
		mutationFn: async ({
			tempChatTurnCdo,
			characterInfo,
			profileInfo,
			aiModelInfo,
			recentChatTurnString,
		}) => {
			const url = genApiUrl(MODULE_NAME, 'receiveBotResponse');
			const response = await apiClient.post<TempChatTurn>(url, {
				tempChatTurnCdo,
				characterInfo,
				profileInfo,
				aiModelInfo,
				recentChatTurnString,
			});
			return response.data;
		},
	});

	return { receiveBotResponse, finalizeChatTurn };
};
