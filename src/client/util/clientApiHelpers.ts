import Session from 'supertokens-web-js/recipe/session/index.js';
import axios from 'axios';
import { ApiError } from '#shared/domain/error/errors.js';

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
		console.log('API 요청:', config.method?.toUpperCase(), config.url);

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

			// Gracefully handle 404 errors when the custom flag is set
			if (error?.response?.status === 404 && originalRequest._suppress404Error) {
				// By rejecting the promise directly here, we bypass the logging and toasting logic below,
				// allowing the calling code (e.g., React Query's `retry` function) to handle it silently.
				return Promise.resolve({ data: null });
			}

			// Handle 401 Unauthorized for session refresh
			if (error?.response?.status === 401 && !originalRequest._retry) {
				originalRequest._retry = true;
				const refreshResult = await Session.attemptRefreshingSession();
				if (refreshResult) {
					return apiClient(originalRequest); // Retry ONCE
				} else {
					addToast('Your session has expired. Please log in again.', 'error');
				}
				return Promise.reject(error);
			}

			// For all other errors, process and show a toast unless suppressed
			const processedError = processApiError(error);
			if (!originalRequest._suppressToast) {
				addToast(processedError.clientMessage || 'An unexpected error occurred.', 'error');
			}
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
