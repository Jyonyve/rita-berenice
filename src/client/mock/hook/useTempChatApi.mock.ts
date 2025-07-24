// src/mock/hook/useTempChatApi.mock.ts

import { TempChatTurn } from '#shared/domain/chat/ChatInterfaces.js';
import { TempChatResponse } from '#shared/api/ModuleResponse.js';

export const useTempChatApiMock = () => {
	const data: TempChatResponse = {
		ids: [],
		documents: [],
		metadatas: [],
		tempChatTurns: [],
		tempChatTurn: {} as TempChatTurn,
	};
	/**
	 * Mocks saving a temporary chat turn.
	 * Logs the action and resolves immediately.
	 */
	const saveTempChatTurn = {
		mutateAsync: async (tempData: TempChatTurn): Promise<void> => {
			console.log('[MOCK] saveTempChatTurn called with:', tempData);
			return Promise.resolve();
		},
		isLoading: false,
		isError: false,
		error: null,
	};

	/**
	 * Mocks fetching a temporary chat turn by session and sequence.
	 * Returns the first turn as a fallback, or an empty response if not found.
	 */
	const getTempChatTurn = (sessionId: string, sequence: number, isLoadingHistory: boolean) => {
		return { data, isLoading: false, isError: false, error: null };
	};

	/**
	 * Mocks fetching the last temp turns for a list of session IDs.
	 * Returns all mock temp chat data regardless of input.
	 */
	const getLastTempTurnsForSessions = (sessionIds: string[]) => ({
		data: null,
		isLoading: false,
		isError: false,
		error: null,
	});

	return { saveTempChatTurn, getTempChatTurn, getLastTempTurnsForSessions };
};
