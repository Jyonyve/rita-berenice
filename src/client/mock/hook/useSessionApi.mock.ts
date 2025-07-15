import { ChatResponse } from '#shared/api/ModuleResponse.js';
import { mockMondayChat } from '../data/mockChatData.js';
import { mockMondaySession } from '../data/mockSessionData.js';
import { SessionInfo } from '#shared/domain/session/SessionInterfaces.js';

export const useSessionApiMock = () => {
	/**
	 * Mocks fetching all sessions for a given user.
	 */
	const getSessionsByUserId = (userId: string) => ({
		data: mockMondaySession,
		isLoading: false,
		isError: false,
		error: null,
	});

	/**
	 * Mocks fetching all sessions for a given user and character.
	 */
	const getSessionsByUserIdAndCharacterId = (userId: string, characterId: string) => ({
		data: mockMondaySession,
		isLoading: false,
		isError: false,
		error: null,
	});

	/**
	 * Mocks fetching a single session by its ID.
	 */
	const getSession = (sessionId: string) => {
		return { data: mockMondaySession, isLoading: false, isError: false, error: null };
	};

	/**
	 * Mocks updating a session after a new message.
	 */
	const updateSessionOnNewMessage = {
		mutateAsync: async ({
			sessionId,
			latestCharMessage,
		}: {
			sessionId: string;
			latestCharMessage: string;
		}): Promise<void> => {
			console.log('[MOCK] updateSessionOnNewMessage called with:', { sessionId, latestCharMessage });
			return Promise.resolve();
		},
		isLoading: false,
		isError: false,
		error: null,
	};

	/**
	 * Mocks creating a new session.
	 * Logs the action and returns a resolved promise with a mock SessionInfo.
	 */
	const createSession = {
		mutateAsync: async ({
			userId,
			characterId,
			profileId,
			firstCharMessage,
		}: {
			userId: string;
			characterId: string;
			profileId: string;
			firstCharMessage: string;
		}): Promise<SessionInfo> => {
			console.log('[MOCK] createSession called with:', {
				userId,
				characterId,
				profileId,
				firstCharMessage,
			});
			// Return a mock session info object (pick the first from mock data or construct one)
			return Promise.resolve(
				mockMondaySession.sessionInfos?.[0] ?? {
					sessionId: 'mock-session-id-12345',
					userId,
					characterId,
					profileId,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
					title: 'Mock Session',
					latestCharMessage: firstCharMessage,
				}
			);
		},
		isLoading: false,
		isError: false,
		error: null,
	};

	return {
		createSession,
		getSessionsByUserId,
		getSession,
		updateSessionOnNewMessage,
		getSessionsByUserIdAndCharacterId,
	};
};
