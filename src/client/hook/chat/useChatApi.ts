import { useState, useCallback } from 'react';
import {
	AiModelInfo,
	ChatRoleType,
	ChatTurn,
	MODULE_NAMES,
	TempChatTurn,
	apiClient,
	genApiUrl,
} from '@shared/index.ts'; // Or shared types

export const useChatApi = (sessionId: string) => {
	//
	// --- Helper for API calls ---
	// Encapsulates error handling and common logic
	const _makeApiCall = useCallback(
		async <T = any>(
			moduleName: string,
			methodName: string,
			httpMethod: 'get' | 'post' | 'delete' = 'get',
			urlParamValues: (string | number)[] = [],
			params: Record<string, any> = {},
			body: Record<string, any> = {}
		): Promise<T> => {
			const urlPath = genApiUrl(moduleName, methodName, urlParamValues);
			try {
				let response;
				switch (httpMethod) {
					case 'post':
						response = await apiClient.post<T>(urlPath, body, { params });
						break;
					case 'delete':
						response = await apiClient.delete<T>(urlPath, { params });
						break;
					case 'get':
					default:
						response = await apiClient.get<T>(urlPath, { params });
						break;
				}
				return response.data;
			} catch (error: any) {
				throw error;
			}
		},
		[sessionId, apiClient]
	);

	// --- CHAT Module API Functions (Based on chat.routes.ts [2]) ---

	const getRecentChatTurns = useCallback(
		async (sessionId: string, limit: number): Promise<ChatTurn[]> => {
			if (!sessionId) throw new Error('Session ID required');
			// GET /api/chat/get-recent-chat-turns/:sessionId?limit=...
			return await _makeApiCall<ChatTurn[]>(
				MODULE_NAMES.CHAT,
				'getRecentChatTurns',
				'get',
				[sessionId],
				{ limit }
			);
		},
		[_makeApiCall]
	);

	const getLoadingChatTurns = useCallback(
		async (sessionId: string, beforeSequence: number, limit: number): Promise<ChatTurn[]> => {
			if (!sessionId) throw new Error('Session ID required');
			// GET /api/chat/get-loading-chat-turns/:sessionId?beforeSequence=...&limit=...
			return await _makeApiCall<ChatTurn[]>(
				MODULE_NAMES.CHAT,
				'getLoadingChatTurns',
				'get',
				[sessionId],
				{ beforeSequence, limit }
			);
		},
		[_makeApiCall]
	);

	const storeRequest = useCallback(
		async (chatTurn: ChatTurn): Promise<void> => {
			const sessionId = chatTurn.sessionId;
			if (!sessionId) throw new Error('Session ID required');
			// POST /api/chat/store-request/:sessionId
			// Body: { chatTurn: ChatTurn }
			await _makeApiCall<void>(
				MODULE_NAMES.CHAT,
				'storeRequest',
				'post',
				[sessionId],
				{},
				{ chatTurn } // Body structure as defined in route [2]
			);
		},
		[_makeApiCall]
	);

	const storeResponse = useCallback(
		async (chatTurn: ChatTurn): Promise<void> => {
			const sessionId = chatTurn.sessionId;
			if (!sessionId) throw new Error('Session ID required');
			// POST /api/chat/store-response/:sessionId
			// Body: { chatTurn: ChatTurn }
			await _makeApiCall<void>(
				MODULE_NAMES.CHAT,
				'storeResponse',
				'post',
				[sessionId],
				{},
				{ chatTurn } // Body structure as defined in route [2]
			);
		},
		[_makeApiCall]
	);

	const storeChatTurn = useCallback(
		async (chatTurn: ChatTurn): Promise<void> => {
			const sessionId = chatTurn.sessionId;
			if (!sessionId) throw new Error('Session ID required');
			// POST /api/chat/store-chat-turn/:sessionId
			// Body: { chatTurn: ChatTurn }
			await _makeApiCall<void>(
				MODULE_NAMES.CHAT,
				'storeChatTurn',
				'post',
				[sessionId],
				{},
				{ chatTurn } // Body structure as defined in route [2]
			);
		},
		[_makeApiCall]
	);

	const getChatTurnBySequence = useCallback(
		async (sessionId: string, sequence: number): Promise<ChatTurn> => {
			if (!sessionId) throw new Error('Session ID required');
			// GET /api/chat/get-chat-turn-by-sequence/:sessionId/:sequence
			return await _makeApiCall<ChatTurn>(MODULE_NAMES.CHAT, 'getChatTurnBySequence', 'get', [
				sessionId,
				sequence,
			]);
		},
		[_makeApiCall]
	);

	const getRecap = useCallback(
		async (sessionId: string): Promise<string> => {
			if (!sessionId) throw new Error('Session ID required');
			// GET /api/chat/get-recap/:sessionId
			// Response: { recap: string }
			const responseData = await _makeApiCall<{ recap: string }>(
				MODULE_NAMES.CHAT,
				'getRecap',
				'get',
				[sessionId]
			);
			return responseData?.recap ?? '';
		},
		[_makeApiCall]
	);

	const queryChatLog = useCallback(
		async (sessionId: string, queryText: string, limit: number): Promise<string[]> => {
			if (!sessionId) throw new Error('Session ID required');
			// GET /api/chat/query-chat-log/:sessionId?q=...&limit=... [2]
			return await _makeApiCall<string[]>(
				MODULE_NAMES.CHAT,
				'queryChatLog',
				'get',
				[sessionId],
				{ q: queryText, limit } // Use 'q' as query param name [2]
			);
		},
		[_makeApiCall]
	);

	const buildUserPromptFromLog = useCallback(
		async (sessionId: string, userText: string, isFullLogQuery?: boolean): Promise<string> => {
			if (!sessionId) throw new Error('Session ID required');
			// POST /api/chat/build-user-prompt-from-log/:sessionId [2]
			// Body: { userText: string, isFullLogQuery?: boolean }
			const responseData = await _makeApiCall<{ prompt: string }>(
				MODULE_NAMES.CHAT,
				'buildUserPromptFromLog',
				'post',
				[sessionId],
				{},
				{ userText, isFullLogQuery } // Body structure from route [2]
			);
			return responseData?.prompt ?? '';
		},
		[_makeApiCall]
	);

	const genResponseFromLlm = useCallback(
		async (
			sessionId: string,
			role: ChatRoleType,
			prompt: string,
			aiModelInfo: AiModelInfo,
			personaInstruction: string
		): Promise<{ assistantResponse: string }> => {
			// Define expected response shape
			if (!sessionId) throw new Error('Session ID required');
			// Adjust module/methodName if this calls a different API or endpoint
			// Example: POST /api/chat/gen-response-from-llm/:sessionId
			return await _makeApiCall<{ assistantResponse: string }>(
				MODULE_NAMES.LLM,
				'genResponseFromLlm', // Assumed corresponding method name
				'post',
				[sessionId],
				{},
				{ role, prompt, aiModelInfo, personaInstruction }
			);
		},
		[_makeApiCall]
	);

	// --- TEMP_CHAT Module API Functions (Based on tempChat.routes.ts [1]) ---

	const getTempChatTurn = useCallback(
		async (sessionId: string): Promise<TempChatTurn | null> => {
			try {
				return await _makeApiCall<TempChatTurn | null>(
					MODULE_NAMES.TEMP_CHAT,
					'getTempChatTurn',
					'get',
					[sessionId]
				);
			} catch (error: any) {
				if (error.response?.status === 404) return null;
				throw error;
			}
		},
		[_makeApiCall]
	);

	const saveTempChatTurn = useCallback(
		async (tempData: TempChatTurn): Promise<void> => {
			if (!tempData?.sessionId) throw new Error('Temp data with Session ID required');
			// POST /api/temp-chat/save-temp-chat-turn [1]
			// Body: { tempData: TempChatTurn }
			await _makeApiCall<void>(
				MODULE_NAMES.TEMP_CHAT,
				'saveTempChatTurn',
				'post',
				[], // No URL params
				{}, // No query params
				{ tempData } // Body structure as defined in route [1]
			);
		},
		[_makeApiCall]
	);

	const removeTempChatTurn = useCallback(
		async (sessionId: string): Promise<void> => {
			if (!sessionId) throw new Error('Session ID required');
			// DELETE /api/temp-chat/remove-temp-chat-turn/:sessionId [1]
			await _makeApiCall<void>(
				MODULE_NAMES.TEMP_CHAT,
				'removeTempChatTurn',
				'delete',
				[sessionId] // sessionId as path param value
			);
		},
		[_makeApiCall]
	);

	// --- Return API Action Functions ---
	return {
		// CHAT actions
		getRecentChatTurns,
		getLoadingChatTurns,
		storeChatTurn,
		storeRequest,
		storeResponse,
		getChatTurnBySequence,
		getRecap,
		queryChatLog,
		buildUserPromptFromLog,
		genResponseFromLlm,

		// TEMP_CHAT actions
		getTempChatTurn,
		saveTempChatTurn,
		removeTempChatTurn,
	};
};
