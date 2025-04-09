import axios from 'axios';

// Get the base URL from environment variables (e.g., http://localhost:3000)
const backendApiUrl =
	typeof import.meta.env?.VITE_API_URL !== 'undefined'
		? import.meta.env.VITE_API_URL // Use Vite's value if available
		: process.env.VITE_API_URL;

// Create a single base instance for all API calls
export const apiClient = axios.create({
	// Prepend /api to the base URL automatically
	baseURL: `${backendApiUrl || 'http://localhost:3000'}/api`,
	headers: {
		'Content-Type': 'application/json',
		// You might add other default headers here later (e.g., Authorization)
	},
});

// Add a response interceptor for centralized error handling/logging
apiClient.interceptors.response.use(
	(response) => response, // Simply return successful responses
	(error) => {
		// Log the error details
		console.error('API Call Error:', {
			message: error.message,
			url: error.config?.url,
			method: error.config?.method,
			status: error.response?.status,
			data: error.response?.data,
		});

		// You could add more sophisticated error handling here:
		// - Redirect to login on 401 Unauthorized
		// - Show a generic error message to the user

		// Reject the promise so downstream .catch() blocks can handle it
		return Promise.reject(error);
	}
);
