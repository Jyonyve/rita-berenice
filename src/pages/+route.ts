import type { RouteSync } from 'vike/types';

// Route Functions enables advanced routing logic
export const route: RouteSync = (pageContext): ReturnType<RouteSync> => {
	const { urlPathname } = pageContext;

	// Root route
	if (urlPathname === '/' || urlPathname === '') {
		return { routeParams: { page: 'index' } };
	}

	// Character route
	if (urlPathname === '/character') {
		return { routeParams: { page: 'character' } };
	}

	// 404 for unmatched routes
	return false;
};
