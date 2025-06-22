// src/client/api/apiClient.ts

import { processApiError } from '@client/util/clientHelpers.ts';
import axios from 'axios';

// Get the base URL from environment variables
const backendApiUrl =
	typeof import.meta.env?.VITE_API_URL !== 'undefined'
		? import.meta.env.VITE_API_URL
		: process.env.VITE_API_URL;

// Create a single base instance for all API calls
export const apiClient = axios.create({
	baseURL: `${backendApiUrl || 'http://localhost:3000'}/api`,
	headers: { 'Content-Type': 'application/json' },
});

// --- REVISED RESPONSE INTERCEPTOR ---
apiClient.interceptors.response.use(
	// For successful responses (status 2xx), do nothing and let them pass through.
	(response) => response,

	// For any error response, process it through our standardized helper.
	(error) => {
		// 1. Process the raw error (AxiosError, network error, etc.) into our standard ApiError.
		const processedError = processApiError(error);

		// 2. (Optional) This is the perfect place for global side-effects.
		// For example, if you want to show a toast notification for every error:
		// toast.error(processedError.clientMessage || 'An error occurred.');

		// Or handle authentication errors globally:
		// if (processedError.status === 401) {
		//   authStore.logout();
		//   window.location.href = '/login';
		// }

		// 3. Reject the promise with the STANDARDIZED error object.
		// This is the crucial step. The .catch() block in your hooks will now
		// receive this clean, predictable ApiError object.
		return Promise.reject(processedError);
	}
);
