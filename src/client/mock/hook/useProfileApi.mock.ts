import { ChatResponse } from '#shared/api/ModuleResponse.js';
import { mockMondayChat } from '../data/mockChatData.ts';
import { mockMondaySession } from '../data/mockSessionData.ts';

export const useProfileApiMock = () => {
	const getProfileBySessionId = (sessionId: string) => ({
		data: mockMondaySession,
		isLoading: false,
		isError: false,
		error: null,
	});

	return { getProfileBySessionId };
};
