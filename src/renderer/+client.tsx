// renderer/+client.tsx
import { hydrateRoot } from 'react-dom/client';
import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { theme } from '#root/src/client/assets/theme';
import { PageContextClient } from 'vike/types';
import { PageContextProvider } from './usePageContext';

export async function render(pageContext: PageContextClient) {
	const { Page } = pageContext;
	const cache = createCache({ key: 'mui' });

	const container = document.getElementById('root');
	if (!container) throw new Error('No root element');

	// Add this type assertion to fix the TypeScript error
	const PageComponent = Page as React.ComponentType<any>;

	const app = (
		<PageContextProvider pageContext={pageContext}>
			<CacheProvider value={cache}>
				<ThemeProvider theme={theme}>
					<CssBaseline />
					<StrictMode>
						<PageComponent />
					</StrictMode>
				</ThemeProvider>
			</CacheProvider>
		</PageContextProvider>
	);

	if (container.innerHTML === '' || !pageContext.isHydration) {
		const root = createRoot(container);
		root.render(app);
	} else {
		hydrateRoot(container, app);
	}
}
