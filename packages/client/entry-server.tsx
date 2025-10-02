// src/entry-server.tsx

import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { StaticRouter } from 'react-router'; // Use StaticRouter for server
import createEmotionServer from '@emotion/server/create-instance';
import { AppProviders } from './AppProviders.js';
import { App } from './App.js';
import { createEmotionCache } from './util/index.js';

interface RenderResult {
	html: string;
	emotionStyleTags: string;
}

export function render(url: string): RenderResult {
	const serverSideEmotionCache = createEmotionCache();
	const { extractCriticalToChunks, constructStyleTagsFromChunks } =
		createEmotionServer(serverSideEmotionCache);

	// **FIXED**: The provider tree now exactly matches entry-client.tsx
	const html = ReactDOMServer.renderToString(
		<StaticRouter location={url}>
			<AppProviders emotionCache={serverSideEmotionCache}>
				<App />
			</AppProviders>
		</StaticRouter>
	);

	const emotionChunks = extractCriticalToChunks(html);
	const emotionStyleTags = constructStyleTagsFromChunks(emotionChunks);

	return { html, emotionStyleTags };
}
