import { hydrateRoot } from 'react-dom/client';
import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { theme } from '@asset/theme';
import { PageContextClient } from './types.ts';

export async function render(pageContext: PageContextClient) {
	const { Page } = pageContext;
	const cache = createCache({ key: 'mui' });

	const container = document.getElementById('root');
	if (!container) throw new Error('No root element');

	if (container.innerHTML === '' || !pageContext.isHydration) {
		const root = createRoot(container);
		root.render(
			<CacheProvider value={cache}>
				<ThemeProvider theme={theme}>
					<CssBaseline />
					<StrictMode>
						<Page />
					</StrictMode>
				</ThemeProvider>
			</CacheProvider>
		);
	} else {
		hydrateRoot(
			container,
			<CacheProvider value={cache}>
				<ThemeProvider theme={theme}>
					<CssBaseline />
					<StrictMode>
						<Page />
					</StrictMode>
				</ThemeProvider>
			</CacheProvider>
		);
	}
}
