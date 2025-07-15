import { ChatResponse } from '#shared/api/ModuleResponse.js';
import { mockMondayChat } from '../data/mockChatData.ts';
import { mockMondaySession } from '../data/mockSessionData.js';

export const useSessionApiMock = () => {
	const getSessionsByUserIdAndCharacterId = (userId: string, characterId: string) => ({
		data: mockMondaySession,
		isLoading: false,
		isError: false,
		error: null,
	});
	const createSession = {};

	return { getSessionsByUserIdAndCharacterId, createSession };
};
