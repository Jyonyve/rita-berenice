import React, { ReactNode } from 'react';
import '#root/src/client/assets/Layout.css';
import { PageContextProvider } from './usePageContext';
import { ChildrenInterface, PageContextInterface } from '@shared/vikeTypes';
import createCache from '@emotion/cache';
import { CacheProvider, ThemeProvider } from '@emotion/react';
import { theme } from '@client/asset/theme';

export const Layout = ({ pageContext, children }: PageContextInterface) => {
	const cache = createCache({ key: 'mui' });

	return (
		<React.StrictMode>
			<PageContextProvider pageContext={pageContext}>
				<CacheProvider value={cache}>
					<ThemeProvider theme={theme}>
						<Frame>
							<Sidebar>
								<a className="navitem" href="/">
									Home
								</a>
								<a className="navitem" href="/about">
									About
								</a>
								<a className="navitem" href="/star-wars">
									Data Fetching
								</a>
							</Sidebar>
							<Content>{children}</Content>
						</Frame>
					</ThemeProvider>
				</CacheProvider>
			</PageContextProvider>
		</React.StrictMode>
	);
};

function Frame({ children }: ChildrenInterface) {
	return <div style={{ display: 'flex', maxWidth: 900, margin: 'auto' }}>{children}</div>;
}

function Sidebar({ children }: ChildrenInterface) {
	return (
		<div
			style={{
				padding: 20,
				paddingTop: 42,
				flexShrink: 0,
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				lineHeight: '1.8em',
			}}
		>
			{children}
		</div>
	);
}

function Content({ children }: ChildrenInterface) {
	return (
		<div style={{ padding: 20, paddingBottom: 50, borderLeft: '2px solid #eee', minHeight: '100vh' }}>
			{children}
		</div>
	);
}
