import axios from 'axios';

const backendApiUrl = import.meta.env.VITE_API_URL;

// Base API instance
export const axiosBackend = axios.create({
	baseURL: backendApiUrl,
	headers: { 'Content-Type': 'application/json' },
});

// Specific routes
export const axiosCharacter = axios.create({
	baseURL: `${backendApiUrl}/character`,
	headers: { 'Content-Type': 'application/json' },
});

export const axiosDocument = axios.create({
	baseURL: `${backendApiUrl}/document`,
	headers: { 'Content-Type': 'application/json' },
});

// ChromaDB specific instance
export const axiosChroma = axios.create({
	baseURL: `${backendApiUrl}/chroma`,
	headers: { 'Content-Type': 'application/json' },
});

// Add response interceptor for error handling
axiosChroma.interceptors.response.use(
	(response) => response,
	(error) => {
		console.error('ChromaDB API Error:', error);
		return Promise.reject(error);
	}
);
