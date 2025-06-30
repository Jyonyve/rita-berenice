// src/client/api/apiClient.ts

import { processApiError } from '#client/util/clientHelpers.js';
import axios from 'axios';
import { useToast } from '../style/index.js';

// Create a single base instance for all API calls
export const apiClient = axios.create({
	baseURL: '/api',
	headers: { 'Content-Type': 'application/json' },
});

const { addToast } = useToast();

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
		addToast(error.clientMessage || 'Failed to save character.', 'error');

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
