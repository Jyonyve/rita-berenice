import type { Config } from 'vike/types';
import { Layout } from './Layout';

export default {
	// Basic Vike config
	prerender: false,
	clientRouting: true,
	hydrationCanBeAborted: true,

	// Pass necessary data to client
	passToClient: ['pageProps', 'title', 'emotionCache', 'muiCache'],

	// Meta configuration
	meta: {
		// Title configuration
		title: { env: { server: true, client: true } },
		// MUI/Emotion configuration
		muiCache: { env: { server: true, client: true } },
		// Data fetching configuration
		dataIsomorph: {
			env: { config: true },
			effect({ configDefinedAt, configValue }) {
				if (typeof configValue !== 'boolean') {
					throw new Error(`${configDefinedAt} should be a boolean`);
				}
				if (configValue) {
					return { meta: { data: { env: { server: true, client: true } } } };
				}
			},
		},
	},

	// Adjust timeouts for data fetching
	hooksTimeout: { data: { error: 30 * 1000, warning: 10 * 1000 } },
} satisfies Config;

// TypeScript declarations
declare global {
	namespace Vike {
		interface Config {
			title?: string;
			muiCache?: boolean;
		}
	}
}
