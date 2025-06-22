import { ApiError } from '#shared/index.ts';
import axios from 'axios';

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
