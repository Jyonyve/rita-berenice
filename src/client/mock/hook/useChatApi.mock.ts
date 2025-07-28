// src/mock/hook/useChatApi.mock.ts

import { ChatTurn } from '#shared/domain/chat/ChatInterfaces.js';
import { ChatResponse } from '#shared/api/ModuleResponse.js';
import { mockMondayChat } from '../data/mockChatData.js';

/**
 * Mock implementation of the useChatApi hook for static builds.
 * All methods return static data or simulate successful actions.
 */
export const useChatApiMock = () => {
	/**
	 * Mocks fetching all chat turns for a session.
	 */
	const getAllChatTurns = (sessionId: string) => ({
		data: mockMondayChat,
		isLoading: false,
		isError: false,
		error: null,
	});

	/**
	 * Mocks fetching a single chat turn by sequence.
	 * Returns the first turn as a fallback, or null if not found.
	 */
	const getChatHistoryForDisplay = (sessionId: string) => {
		const turn = mockMondayChat?.displayTurns?.find((t) => t.sessionId === sessionId) || null;
		return {
			data: turn
				? {
						ids: [mockMondayChat.ids],
						documents: [mockMondayChat.documents],
						metadatas: [mockMondayChat.metadatas],
						chatTurns: [],
						displayTurns: mockMondayChat.displayTurns,
					}
				: { ids: [], documents: [], metadatas: [], chatTurns: [], displayTurns: [] },
			isLoading: false,
			isError: false,
			error: null,
		};
	};

	/**
	 * Mocks storing a chat turn.
	 * Logs the action and returns the input as a resolved promise.
	 */
	const storeChatTurn = async (chatTurn: ChatTurn): Promise<ChatTurn> => {
		console.log('[MOCK] storeChatTurn called with:', chatTurn);
		return Promise.resolve(chatTurn);
	};

	/**
	 * Mocks semantic search over chat turns.
	 * Returns all mock chat data regardless of search query.
	 */
	const queryChatTurns = {
		mutateAsync: async ({
			sessionId,
			queryTexts,
			where,
		}: {
			sessionId: string;
			queryTexts: string[];
			where?: unknown;
		}): Promise<ChatResponse> => {
			console.log('[MOCK] queryChatTurns called with:', { sessionId, queryTexts, where });
			return Promise.resolve(mockMondayChat as ChatResponse);
		},
		isLoading: false,
		isError: false,
		error: null,
	};

	return { storeChatTurn, getAllChatTurns, getChatHistoryForDisplay, queryChatTurns };
};
