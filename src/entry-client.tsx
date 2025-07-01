// src/client/entry-client.tsx

import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { CacheProvider } from '@emotion/react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import { QueryClientProvider } from '@tanstack/react-query';
import { createEmotionCache } from './shared/config/createEmotionCache.js';
import { initQueryClient } from './shared/api/queryClient.js';
import { ToastProvider } from './client/style/ToastProvider.jsx';
import { theme } from './client/theme.js';
import { App } from './client/App.jsx';

function ClientApp() {
	const clientSideEmotionCache = createEmotionCache();
	const [queryClient] = useState(initQueryClient);

	return (
		<React.StrictMode>
			<QueryClientProvider client={queryClient}>
				<ToastProvider>
					<CacheProvider value={clientSideEmotionCache}>
						<ThemeProvider theme={theme}>
							<CssBaseline />
							<BrowserRouter>
								<App />
							</BrowserRouter>
						</ThemeProvider>
					</CacheProvider>
				</ToastProvider>
			</QueryClientProvider>
		</React.StrictMode>
	);
}

const container = document.getElementById('root');

if (!container) {
	throw new Error("Root element '#root' not found for hydration.");
}

// This is React's hydration, and it is ESSENTIAL. It makes the server-rendered HTML interactive.
ReactDOM.hydrateRoot(
	container,
	<ToastProvider>
		<ClientApp />
	</ToastProvider>
);

console.log('React app hydrated on client.');
