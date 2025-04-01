import type { PageContextServer } from 'vike/types';
import { render } from 'vike/abort';

// Define data type
export type PageData = { title: string; pageProps?: Record<string, unknown> };

// Server-side data fetching
async function data(pageContext: PageContextServer): Promise<PageData> {
	const { urlPathname } = pageContext;

	try {
		// Default data
		const defaultData: PageData = { title: 'Rita Berenice', pageProps: {} };

		// Route-specific data
		if (urlPathname === '/') {
			return { ...defaultData, title: 'Home - Rita Berenice' };
		}

		if (urlPathname === '/character') {
			return { ...defaultData, title: 'Character - Rita Berenice' };
		}

		return defaultData;
	} catch (error) {
		console.error('Data fetching error:', error);
		throw render(500, 'Failed to load page data');
	}
}

export { data };
export type Data = Awaited<ReturnType<typeof data>>;
