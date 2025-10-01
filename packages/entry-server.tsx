// src/entry-server.tsx

import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { StaticRouter } from 'react-router'; // Use StaticRouter for server
import createEmotionServer from '@emotion/server/create-instance';
import { App } from '#client/App.jsx';
import { createEmotionCache } from '@rita-berenice/shared/config/createEmotionCache.js';
import { AppProviders } from '#client/AppProviders.jsx';

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
