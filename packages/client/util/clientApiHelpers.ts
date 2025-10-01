import Session from 'supertokens-web-js/recipe/session/index.js';
import axios from 'axios';
import { ApiError } from '@rita-berenice/shared/domain/error/errors.js';
import { toKebabCase } from '@rita-berenice/shared/util/apiHelpers.js';
import { gunzipSync } from 'zlib';

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
			const originalRequest = error.config as any;
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

// src/client/util/compressionUtils.ts

/**
 * Decompresses a gzipped, Base64-encoded string using only native browser APIs.
 * This is the most reliable method, avoiding all Node.js polyfill issues.
 */
export const decompressData = async <T>(compressedBase64: string): Promise<T> => {
	try {
		// Step 1: Decode the Base64 string into a byte stream (Uint8Array).
		// This is the correct, modern way to handle this, despite the legacy name of `atob`.
		const compressedBytes = Uint8Array.from(atob(compressedBase64), (c) => c.charCodeAt(0));

		// Step 2: Create a readable stream from the compressed data.
		const compressedStream = new ReadableStream({
			start(controller) {
				controller.enqueue(compressedBytes);
				controller.close();
			},
		});

		// Step 3: Pipe the data through the native DecompressionStream.
		const decompressionStream = compressedStream.pipeThrough(new DecompressionStream('gzip'));

		// Step 4: Use the Response API to easily read the entire decompressed stream.
		// This is a robust way to handle the stream and get the final result.
		const decompressedBlob = await new Response(decompressionStream).blob();
		const decompressedText = await decompressedBlob.text();

		// Step 5: Parse the resulting JSON text.
		return JSON.parse(decompressedText);
	} catch (error) {
		console.error('Client-side decompression failed:', error);
		throw new Error('Failed to decompress data on the client.');
	}
};
