import { PageContextServer } from 'vike/types';

// src/pages/+route.ts
export default function route(pageContext: PageContextServer) {
	const { urlPathname } = pageContext;
	if (urlPathname === '/') return { routeParams: { page: 'index' } };
	if (urlPathname === '/character') return { routeParams: { page: 'character' } };
	return false;
}
