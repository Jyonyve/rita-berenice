import React from 'react';
import { PageContextProvider } from './usePageContext';
import { ChildrenInterface, PageContextInterface } from '@shared/vikeTypes';
import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '@client/asset/theme';

export function Layout({ children, pageContext }: PageContextInterface) {
	const cache = createCache({ key: 'mui' });

	return (
		<PageContextProvider pageContext={pageContext}>
			<CacheProvider value={cache}>
				<ThemeProvider theme={theme}>{children}</ThemeProvider>
			</CacheProvider>
		</PageContextProvider>
	);
}
