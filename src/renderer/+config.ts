import type { Config } from 'vike/types';

export default {
	// Files to send to browser
	passToClient: ['pageProps', 'urlPathname'],
	// Enable client-side routing
	clientRouting: true,
	// Enable hydration abort
	hydrationCanBeAborted: true,
	// Configure Meta
	// meta: {
	// 	// Enable SSR by default

	// },
} satisfies Config;
