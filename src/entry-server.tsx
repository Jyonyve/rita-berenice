// src/entry-server.tsx
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import createEmotionServer from '@emotion/server/create-instance';
import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import { App } from '#root/src/client/App.tsx';
import { StaticRouter } from 'react-router-dom/server';

export async function render(
	url: string,
	ssrManifest?: Record<string, string[]>
): Promise<{ html: string; head: string }> {
	const emotionCache = createCache({ key: 'emotion-css-cache' });
	const { extractCriticalToChunks, constructStyleTagsFromChunks } =
		createEmotionServer(emotionCache);

	const app = (
		// Use StaticRouter on the server, passing the requested URL
		<StaticRouter location={url}>
			<CacheProvider value={emotionCache}>
				<App />
			</CacheProvider>
		</StaticRouter>
	);

	const appHtml = ReactDOMServer.renderToString(app);
	const emotionChunks = extractCriticalToChunks(appHtml);
	const emotionStyleTags = constructStyleTagsFromChunks(emotionChunks);

	const head = `${emotionStyleTags}`;

	return { html: appHtml, head };
}
