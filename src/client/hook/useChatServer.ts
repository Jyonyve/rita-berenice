import { useState, useCallback } from 'react';
import { ChatTurn, MODULE_NAMES, apiClient, genApiUrl } from '@shared/index.ts'; // Or shared types

export const useChatServer = (initialSessionId: string) => {
	//
	const MODULE_NAME = MODULE_NAMES.CHAT;
	const [sessionId, setSessionId] = useState(initialSessionId);

	// --- Helper for API calls ---
	// Encapsulates error handling and common logic
	const makeApiCall = useCallback(
		async (
			methodName: string,
			httpMethod: 'get' | 'post' = 'get', // Default to GET
			urlParams: (string | number)[] = [], // Params embedded in URL path
			queryParams: Record<string, any> = {}, // Params for query string (?key=value)
			body: Record<string, any> = {} // Data for POST body
		): Promise<any> => {
			if (!sessionId) {
				throw new Error('No active session.');
			}

			// Ensure sessionId is included if required by convention (most methods here use it)
			const finalUrlParams = urlParams.includes(sessionId) ? urlParams : [sessionId, ...urlParams];

			const url = genApiUrl(MODULE_NAME, methodName, finalUrlParams);
			console.log(`Making API call: ${httpMethod.toUpperCase()} ${url}`, { queryParams, body });

			try {
				let response;
				if (httpMethod === 'post') {
					response = await apiClient.post(url, body);
				} else {
					// Default to GET
					response = await apiClient.get(url, { params: queryParams });
				}
				// Assuming successful responses contain data under the 'data' property
				return response.data;
			} catch (error) {
				// The apiClient interceptor already logs errors.
				// You might want specific UI feedback here, or just re-throw.
				console.error(`API call failed for ${methodName}:`, error);
				throw error; // Re-throw to allow component-level error handling
			}
		},
		[sessionId]
	); // Depends on sessionId

	// --- Refactored Hook Functions ---

	const storeChatTurn = useCallback(
		async (chatTurn: ChatTurn) => {
			// API: POST /api/chroma/store-chat-turn/:sessionId
			// Body: { chatTurn: ChatTurn }
			await makeApiCall('storeChatTurn', 'post', [], {}, { chatTurn });
		},
		[makeApiCall] // Depends on the helper function
	);

	const storeSummary = useCallback(
		async (summary: string) => {
			// API: POST /api/chroma/store-summary/:sessionId
			// Body: { summary: string }
			await makeApiCall('storeSummary', 'post', [], {}, { summary });
		},
		[makeApiCall]
	);

	const getSummary = useCallback(async () => {
		// API: GET /api/chroma/get-summary/:sessionId
		// Response: { summary: string }
		const responseData = await makeApiCall('getSummary', 'get');
		return responseData?.summary ?? ''; // Extract summary from response
	}, [makeApiCall]);

	const querySummary = useCallback(
		async (query: string) => {
			// API: GET /api/chroma/query-summary/:sessionId?q=...
			// Response: { result: any } (last result from the array)
			const responseData = await makeApiCall('querySummary', 'get', [], { q: query });
			return responseData?.result; // Extract result from response
		},
		[makeApiCall]
	);

	const queryChatLog = useCallback(
		async (query: string, limit?: number, fixedOnly?: boolean) => {
			// API: GET /api/chroma/query-chat-log/:sessionId?q=...&limit=...&fixedOnly=...
			// Response: Array<any> (results)
			const queryParams: Record<string, any> = { q: query };
			if (limit !== undefined) queryParams.limit = limit;
			if (fixedOnly !== undefined) queryParams.fixedOnly = fixedOnly; // Send explicit value if provided

			return await makeApiCall('queryChatLog', 'get', [], queryParams);
		},
		[makeApiCall]
	);

	const getRecentChatLogs = useCallback(
		async (turnCount?: number, fixedOnly?: boolean) => {
			// API: GET /api/chroma/get-recent-chat-logs/:sessionId?turnCount=...&fixedOnly=...
			// Response: Array<any> (results)
			const queryParams: Record<string, any> = {};
			if (turnCount !== undefined) queryParams.turnCount = turnCount;
			if (fixedOnly !== undefined) queryParams.fixedOnly = fixedOnly;

			return await makeApiCall('getRecentChatLogs', 'get', [], queryParams);
		},
		[makeApiCall]
	);

	const getChatTurnBySequence = useCallback(
		async (sequence: number, fixedOnly?: boolean) => {
			// API: GET /api/chroma/get-chat-turn-by-sequence/:sessionId/:sequence?fixedOnly=...
			// Response: ChatTurn | null
			const queryParams: Record<string, any> = {};
			if (fixedOnly !== undefined) queryParams.fixedOnly = fixedOnly;

			// Pass sequence as a URL parameter value
			return await makeApiCall('getChatTurnBySequence', 'get', [sequence], queryParams);
		},
		[makeApiCall]
	);

	const getAllResponsesForSequence = useCallback(
		async (sequence: number, fixedOnly?: boolean) => {
			// API: GET /api/chroma/get-all-responses-for-sequence/:sessionId/:sequence?fixedOnly=...
			// Response: Array<any>
			const queryParams: Record<string, any> = {};
			if (fixedOnly !== undefined) queryParams.fixedOnly = fixedOnly;

			// Pass sequence as a URL parameter value
			return await makeApiCall('getAllResponsesForSequence', 'get', [sequence], queryParams);
		},
		[makeApiCall]
	);

	const buildUserPromptFromLog = useCallback(
		async (
			// Make this function async if it wasn't already
			userText: string,
			isFullLogQuery?: boolean,
			fixedOnly: boolean = true // Keep client default if desired, API also has default
		): Promise<string> => {
			// Add return type promise
			// API: POST /api/chroma/build-user-prompt-from-log/:sessionId
			// Body: { userText: string, isFullLogQuery?: boolean, fixedOnly?: boolean }
			// Response: { prompt: string }
			const body = { userText, isFullLogQuery, fixedOnly };
			const responseData = await makeApiCall('buildUserPromptFromLog', 'post', [], {}, body);
			return responseData?.prompt ?? ''; // Extract prompt from response
		},
		[makeApiCall]
	);

	// Return the state and the refactored functions
	return {
		sessionId,
		setSessionId,
		storeChatTurn,
		storeSummary,
		getSummary,
		querySummary,
		queryChatLog,
		getRecentChatLogs,
		getChatTurnBySequence,
		getAllResponsesForSequence,
		buildUserPromptFromLog,
	};
};
