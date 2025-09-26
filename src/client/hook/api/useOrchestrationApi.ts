// src/client/hooks/useOrchestrationApi.ts

import { useMutation } from '@tanstack/react-query';
import { apiClient, decompressData, genApiUrl } from '../../util/clientApiHelpers.js';
import { MODULE_NAMES } from '#shared/config/constants.js';
import {
	ChatTurn,
	ChatTurnCdo,
	TempChatTurn,
	TempChatTurnCdo,
} from '#shared/domain/chat/chat.type.js';
import { Payload } from '#shared/util/apiHelpers.js';
import { CharacterInfo } from '#shared/domain/character/character.type.js';
import { AiModelInfo } from '#shared/domain/aimodel/AiInfoTypes.js';
import { ProfileInfo } from '#shared/domain/profile/profile.type.js';

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
			const response = await apiClient.post<Payload>(url, cdo);
			return decompressData<ChatTurn>(response.data.payload);
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
			isScene?: boolean;
		} // Variables type
	>({
		mutationFn: async ({
			tempChatTurnCdo,
			characterInfo,
			profileInfo,
			aiModelInfo,
			recentChatTurnString,
			isScene,
		}) => {
			const url = genApiUrl(MODULE_NAME, 'receiveBotResponse');
			const response = await apiClient.post<Payload>(url, {
				tempChatTurnCdo,
				characterInfo,
				profileInfo,
				aiModelInfo,
				recentChatTurnString,
				isScene,
			});
			return decompressData<TempChatTurn>(response.data.payload);
		},
	});

	return { receiveBotResponse, finalizeChatTurn };
};
