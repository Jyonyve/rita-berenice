// src/mock/hook/useOrchestrationApi.mock.ts

import {
	ChatTurn,
	ChatTurnCdo,
	TempChatTurn,
	TempChatTurnCdo,
} from '#shared/domain/chat/ChatInterfaces.js';
import { CharacterInfo } from '#shared/domain/character/CharacterInterfaces.js';
import { AiModelInfo } from '#shared/domain/aimodel/AiInfoTypes.js';
import { ProfileInfo } from '#shared/domain/profile/ProfileInterfaces.js';

/**
 * Mock implementation of the useOrchestrationApi hook for static builds.
 * All methods return static data or simulate successful actions.
 */
export const useOrchestrationApiMock = () => {
	/**
	 * Mocks finalizing a chat turn.
	 * Logs the action and returns the input as a resolved promise.
	 */
	const finalizeChatTurn = {
		mutateAsync: async (cdo: ChatTurnCdo): Promise<ChatTurn> => {
			console.log('[MOCK] finalizeChatTurn called with:', cdo);
			// Return a mock ChatTurn object; you can customize fields as needed
			return Promise.resolve({} as ChatTurn);
		},
		isLoading: false,
		isError: false,
		error: null,
	};

	/**
	 * Mocks backend orchestration for generating a new character response.
	 * Logs the action and returns a mock TempChatTurn.
	 */
	const receiveBotResponse = {
		mutateAsync: async ({
			tempChatTurnCdo,
			characterInfo,
			profileInfo,
			aiModelInfo,
			recentChatTurnString,
		}: {
			tempChatTurnCdo: TempChatTurnCdo;
			characterInfo: CharacterInfo;
			profileInfo: ProfileInfo;
			aiModelInfo: AiModelInfo;
			recentChatTurnString: string;
		}): Promise<TempChatTurn> => {
			console.log('[MOCK] receiveBotResponse called with:', {
				tempChatTurnCdo,
				characterInfo,
				profileInfo,
				aiModelInfo,
				recentChatTurnString,
			});
			// Return a mock TempChatTurn object; customize as needed
			return Promise.resolve({} as TempChatTurn);
		},
		isLoading: false,
		isError: false,
		error: null,
	};

	return { receiveBotResponse, finalizeChatTurn };
};
