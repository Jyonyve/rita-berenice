import { ReactNode } from 'react';

// https://vike.dev/pageContext#typescript
declare global {
	namespace Vike {
		interface PageContext {
			// Remove the Page property as it's already defined by Vike
			data?: {
				// Needed by getPageTitle() and onBeforePrerenderStart()
				title?: string;
			};
			config: {
				/** Title defined statically by /pages/some-page/+title.js (or by `export default { title }` in /pages/some-page/+config.js) */
				title?: string;
			};
			abortReason?: string;
			someAsyncProps?: number;
			is404?: boolean;
		}
	}
}

// Tell TypeScript that this file isn't an ambient module
export {};
