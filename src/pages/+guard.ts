import type { GuardAsync } from 'vike/types';
import { render } from 'vike/abort';

export const guard: GuardAsync = async (pageContext): ReturnType<GuardAsync> => {
	const { urlPathname } = pageContext;

	// Handle API routes
	if (urlPathname.startsWith('/api/')) {
		try {
			// Simple rate limiting check (replace with your actual implementation)
			const requestLimit = 10; // requests per minute
			const currentRequests = 0; // implement your counter here

			if (currentRequests > requestLimit) {
				throw render(
					429,
					'Too many requests'
					// retryAfter: 60, // seconds
				);
			}
		} catch (error) {
			// Handle unexpected errors
			console.error('API Guard Error:', error);
			throw render(500, 'Internal Server Error');
		}
	}
};
