import { ApiError } from '#server/util/serviceHelpers.js';

import { QueryClient, QueryCache } from '@tanstack/react-query';
import axios from 'axios';

// API 클라이언트 인스턴스 생성
export const apiClient = axios.create({
	baseURL: '/api',
	headers: { 'Content-Type': 'application/json' },
});

// Hook-safe 방식으로 toast handler 주입
export function setupApiClient(
	addToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
) {
	apiClient.interceptors.response.use(
		(response) => response,
		(error) => {
			const processedError = processApiError(error);
			addToast(processedError.clientMessage || 'Failed to save character.', 'error');
			return Promise.reject(processedError);
		}
	);
}

export const processApiError = (err: unknown): ApiError => {
	// Log the raw error for developer debugging. This is the only place you need to console.error.
	console.error('API Error Intercepted:', err);

	// Case 1: The server responded with an error (status code outside 2xx)
	if (axios.isAxiosError(err) && err.response?.data) {
		const serverError = err.response.data;
		// Re-construct the ApiError object to ensure it has the correct class instance on the client.
		return new ApiError(
			serverError.status || 500,
			serverError.message || 'An error occurred on the server.',
			serverError.clientMessage,
			serverError.details
		);
	}

	// Case 2: It's a network request error (e.g., server is down, CORS)
	if (axios.isAxiosError(err) && !err.response) {
		return new ApiError(
			503, // Service Unavailable is a fitting status code
			'Network Error',
			'The server is currently unavailable. Please try again later.'
		);
	}

	// Case 3: A non-API, unexpected client-side error occurred during the request setup
	if (err instanceof Error) {
		return new ApiError(500, err.message, 'An unexpected application error occurred.');
	}

	// Fallback for non-Error exceptions
	return new ApiError(500, 'An unknown error occurred.');
};

// Define the type for your addToast function
type AddToastFunction = (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;

/**
 * Creates and configures a new QueryClient instance.
 * @param addToast A function to display toast notifications.
 * @returns A configured QueryClient instance.
 */
export function initQueryClient(addToast: AddToastFunction): QueryClient {
	return new QueryClient({
		queryCache: new QueryCache({
			onError: (error) => {
				if (error instanceof ApiError) {
					if (error.status !== 404) {
						addToast(error.clientMessage || 'An unexpected error occurred.', 'error');
					}
				} else if (error instanceof Error) {
					addToast(error.message, 'error');
				}
			},
		}),
		defaultOptions: {
			queries: {
				staleTime: 60 * 1000, // 1 minute
				// You could add global retries here too, e.g., retry: 2,
			},
			mutations: {
				onError: (error) => {
					if (error instanceof ApiError) {
						// For 404s, we often don't want to show a toast.
						if (error.status !== 404) {
							addToast(error.clientMessage || 'Mutation failed.', 'error');
						}
					} else if (error instanceof Error) {
						addToast(error.message, 'error');
					}
				},
			},
		},
	});
}
