import Session from 'supertokens-web-js/recipe/session/index.js';
import axios, { AxiosRequestConfig } from 'axios';
import { ApiError } from '@rita-berenice/shared/domain';
import { toKebabCase } from '@rita-berenice/shared/util';

export type ApiRequestConfig = AxiosRequestConfig & {
	_suppressToast?: boolean;
	_suppress404Error?: boolean;
	_retry?: boolean;
};

// API 클라이언트 인스턴스 생성
export const apiClient = axios.create({
	baseURL: '/api',
	headers: { 'Content-Type': 'application/json' },
});

// Hook-safe 방식으로 toast handler 주입
export function setupApiClient(
	addToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
) {
	// 요청 인터셉터: 요청 로그 출력
	apiClient.interceptors.request.use(async (config) => {
		// First, check if a session exists. This is a cheap, non-network call.
		if (await Session.doesSessionExist()) {
			// Only if a session exists, get the token and attach it.
			const token = await Session.getAccessToken();
			config.headers = config.headers || {};
			config.headers.Authorization = `Bearer ${token}`;
		}

		return config;
	});
	// 응답 인터셉터: 에러 처리
	// In your apiClient setup file
	apiClient.interceptors.response.use(
		(response) => response,
		async (error) => {
			const originalRequest = error.config as ApiRequestConfig;
			// 1. The Suppression Override: This is the most important check.
			// It runs before any other logic.
			if (error?.response?.status === 404 && originalRequest._suppress404Error) {
				console.log(
					'%cINTERCEPTOR: Suppressing expected 404 as requested. Please ignore the 404 error console.',
					'color: green; font-weight: bold;'
				);
				return Promise.resolve({ data: null });
			}

			// 2. Session Refresh Logic: This runs only for non-suppressed errors.
			if (error?.response?.status === 401 && !originalRequest._retry) {
				originalRequest._retry = true;
				const refreshResult = await Session.attemptRefreshingSession();
				if (refreshResult) {
					return apiClient(originalRequest);
				} else {
					addToast('Your session has expired. Please log in again.', 'error');
				}
			}

			// 3. General Error Processing: For all other errors, standardize them.
			const processedError = processApiError(error);
			if (!originalRequest._suppressToast) {
				addToast(processedError.clientMessage || 'An unexpected error occurred.', 'error');
			}
			// Reject with the standardized error for TanStack Query's retry logic to use.
			return Promise.reject(processedError);
		}
	);
}

export const processApiError = (err: unknown): ApiError => {
	// Log the raw error for developer debugging
	console.error('API Error Intercepted:', err);

	// This is the key part that handles the translation
	if (axios.isAxiosError(err) && err.response?.data) {
		const serverError = err.response.data;

		// Correctly read the "code" from the server's JSON payload
		// and map it to the "status" of the client-side ApiError.
		const statusCode = serverError.code || err.response.status || 500;

		return new ApiError(
			statusCode,
			serverError.message || 'An error occurred on the server.',
			serverError.clientMessage,
			serverError.details
		);
	}

	// Fallback cases for network errors or unexpected client errors
	if (axios.isAxiosError(err) && !err.response) {
		return new ApiError(503, 'Network Error', 'The server is currently unavailable.');
	}
	if (err instanceof Error) {
		return new ApiError(500, err.message, 'An unexpected application error occurred.');
	}

	return new ApiError(500, 'An unknown error occurred.');
};

const buildAuthenticatedHeaders = async (): Promise<Headers> => {
	const headers = new Headers({
		'Content-Type': 'application/json',
		Accept: 'application/x-ndjson',
	});
	if (await Session.doesSessionExist()) {
		const token = await Session.getAccessToken();
		headers.set('Authorization', `Bearer ${token}`);
	}
	return headers;
};

const openAuthenticatedStream = async (
	url: string,
	body: unknown,
	signal?: AbortSignal,
	canRetry: boolean = true
): Promise<Response> => {
	const response = await fetch(`/api${url}`, {
		method: 'POST',
		headers: await buildAuthenticatedHeaders(),
		body: JSON.stringify(body),
		credentials: 'include',
		signal,
	});

	if (response.status === 401 && canRetry && (await Session.attemptRefreshingSession())) {
		return openAuthenticatedStream(url, body, signal, false);
	}

	if (!response.ok) {
		const errorBody = await response.json().catch(() => ({}));
		throw new ApiError(
			response.status,
			errorBody.message || `Streaming request failed with status ${response.status}.`,
			errorBody.clientMessage
		);
	}
	return response;
};

export const consumeNdjsonStream = async <T>(
	url: string,
	body: unknown,
	onEvent: (event: T) => void,
	signal?: AbortSignal
): Promise<void> => {
	const response = await openAuthenticatedStream(url, body, signal);
	if (!response.body) {
		throw new ApiError(502, 'Streaming response body is missing.');
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';

	try {
		while (true) {
			const { done, value } = await reader.read();
			buffer += decoder.decode(value, { stream: !done });
			const lines = buffer.split('\n');
			buffer = lines.pop() || '';

			for (const line of lines) {
				if (line.trim()) {
					onEvent(JSON.parse(line) as T);
				}
			}
			if (done) break;
		}

		if (buffer.trim()) {
			onEvent(JSON.parse(buffer) as T);
		}
	} finally {
		reader.releaseLock();
	}
};

/**
 * Generates a concrete API URL path suitable for client-side API calls.
 * Inserts actual parameter values into the path.
 *
 * @param moduleName - The resource name (e.g., 'chroma', 'character', 'chat'). Should be singular.
 * @param methodName - The operation being performed (e.g., 'storeChatTurn', 'getSummary').
 * @param paramValues - Optional array of parameter values to insert into the path (e.g., ['session123', 5]). Values are URI encoded.
 * @returns The concrete API URL path string (e.g., '/api/chroma/store-chat-turn/session123'). Note: Base URL (domain) is added by apiClient.
 */
export function genApiUrl(
	moduleName: string,
	methodName: string,
	paramValues: (string | number)[] = []
): string {
	const kebabMethod = toKebabCase(methodName);
	let path = `/${moduleName}/${kebabMethod}`; // Base path

	// Append encoded parameter values if any are provided
	if (paramValues.length > 0) {
		const encodedValues = paramValues.map((val) => encodeURIComponent(String(val))).join('/');
		path += `/${encodedValues}`;
	}

	return path;
}
