// src/entry-server.tsx

import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { StaticRouter } from 'react-router'; // Use StaticRouter for server
import { CacheProvider } from '@emotion/react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import createEmotionServer from '@emotion/server/create-instance';
import { ToastProvider } from '#client/src/client/provider/ToastProvider.js';
import { App } from '#client/App.jsx';
import { QueryClientProvider } from '@tanstack/react-query';
import { createEmotionCache } from './shared/config/createEmotionCache.js';
import { initQueryClient } from './shared/api/queryClient.js';
import { getTheme } from './client/index.js';
import { SuperTokensWrapper } from 'supertokens-auth-react';

interface RenderResult {
	html: string;
	emotionStyleTags: string;
}

// Make sure this function signature matches how it's called in server.ts
export function render(url: string): RenderResult {
	// 1. Create a new cache instance *for each request*
	const cache = createEmotionCache();
	const { extractCriticalToChunks, constructStyleTagsFromChunks } = createEmotionServer(cache);
	const queryClient = initQueryClient();

	// 2. Render the app wrapped in necessary providers (NO HelmetProvider)
	const appHtml = ReactDOMServer.renderToString(
		<QueryClientProvider client={queryClient}>
			<ToastProvider>
				<CacheProvider value={cache}>
					<ThemeProvider theme={getTheme('dark')}>
						<CssBaseline />
						<StaticRouter location={url}>
							<SuperTokensWrapper>
								<App />
							</SuperTokensWrapper>
						</StaticRouter>
					</ThemeProvider>
				</CacheProvider>
			</ToastProvider>
		</QueryClientProvider>
	);

	// 3. Extract the critical Emotion styles
	const emotionChunks = extractCriticalToChunks(appHtml);
	const emotionStyleTags = constructStyleTagsFromChunks(emotionChunks);

	// 4. Return HTML and the extracted style tags
	return { html: appHtml, emotionStyleTags }; // Remove helmetContext
}
