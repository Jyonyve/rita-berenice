import axios from 'axios';

// Get the base URL from environment variables (e.g., http://localhost:3000)
const backendApiUrl = import.meta.env.VITE_API_URL;

// Create a single base instance for all API calls
export const apiClient = axios.create({
	// Prepend /api to the base URL automatically
	baseURL: `${backendApiUrl}/api`,
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

// Example Usage (in your React components/hooks):
/*
import { apiClient } from '@/utils/axios'; // Adjust import path

// Get all characters
apiClient.get('/character') // Changed from /characters
    .then(response => console.log(response.data))
    .catch(error => console.error("Failed to fetch characters")); // Log message can stay plural

// Get details for a specific character
const characterName = 'someCharacter';
apiClient.get(`/character/${characterName}`) // Changed from /characters/
    .then(response => console.log(response.data));

// Create a new character
const newCharData = { name: 'New Guy', description: '...' };
apiClient.post('/character', newCharData) // Changed from /characters
    .then(response => console.log('Character created:', response.data));

// Send a chat message
const sessionId = 'char_variant_uuid';
const messageData = { text: 'Hello!' };
apiClient.post(`/chat/${sessionId}/message`) // Changed from /chats/
    .then(response => console.log('Message response:', response.data));
*/
