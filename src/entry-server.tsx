// src/server/entry-server.tsx

import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { StaticRouter } from 'react-router-dom'; // Use StaticRouter for server
import { CacheProvider } from '@emotion/react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import createEmotionServer from '@emotion/server/create-instance';
import { createEmotionCache } from '#shared/config/index.js'; // Use your shared utility
import { theme, App } from '#client/index.js'; // Import theme and App

interface RenderResult {
	html: string;
	emotionStyleTags: string;
}

// Make sure this function signature matches how it's called in server.ts
export function render(url: string): RenderResult {
	// 1. Create a new cache instance *for each request*
	const cache = createEmotionCache();
	const { extractCriticalToChunks, constructStyleTagsFromChunks } = createEmotionServer(cache);

	// 2. Render the app wrapped in necessary providers (NO HelmetProvider)
	const appHtml = ReactDOMServer.renderToString(
		<CacheProvider value={cache}>
			{/* Emotion wrapper */}
			<ThemeProvider theme={theme}>
				{/* MUI Theme wrapper */}
				<CssBaseline /> {/* MUI CSS reset */}
				<StaticRouter location={url}>
					{/* Router wrapper */}
					<App />
				</StaticRouter>
			</ThemeProvider>
		</CacheProvider>
	);

	// 3. Extract the critical Emotion styles
	const emotionChunks = extractCriticalToChunks(appHtml);
	const emotionStyleTags = constructStyleTagsFromChunks(emotionChunks);

	// 4. Return HTML and the extracted style tags
	return { html: appHtml, emotionStyleTags }; // Remove helmetContext
}
