// src/entry-server.tsx
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import createEmotionServer from '@emotion/server/create-instance';
// import createCache from '@emotion/cache'; // Remove direct import
import { CacheProvider, ThemeProvider } from '@emotion/react';
import { StaticRouter } from 'react-router-dom'; // Correct import name

import createEmotionCache from './shared/util/createEmotionCache.ts';
import { theme, App } from './client/index.ts';

export async function render(url: string) {
	// Removed ssrManifest for simplicity unless needed
	// Use the utility function to create the cache
	const emotionCache = createEmotionCache(); // <<< Use the function
	const { extractCriticalToChunks, constructStyleTagsFromChunks } =
		createEmotionServer(emotionCache);

	const app = (
		// Add StrictMode if desired for development checks
		<React.StrictMode>
			<StaticRouter location={url}>
				{/* Use StaticRouter */}
				<CacheProvider value={emotionCache}>
					<ThemeProvider theme={theme}>
						<App />
					</ThemeProvider>
				</CacheProvider>
			</StaticRouter>
		</React.StrictMode>
	);

	const appHtml = ReactDOMServer.renderToString(app);
	const emotionChunks = extractCriticalToChunks(appHtml);
	const emotionStyleTags = constructStyleTagsFromChunks(emotionChunks);
	const head = `${emotionStyleTags}`;

	return { html: appHtml, head };
}
