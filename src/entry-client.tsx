// src/client/entry-client.tsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { CacheProvider } from '@emotion/react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import { QueryClientProvider } from '@tanstack/react-query';
import { createEmotionCache } from '#shared/config/index.js';
import { App } from '#client/App.tsx';
import { ToastProvider, useToast } from '#client/index.js';
import { theme } from '#client/theme.js';
import { initQueryClient } from '#client/util/clientHelpers.js';

function ClientApp() {
	const clientSideEmotionCache = createEmotionCache();
	const { addToast } = useToast();
	const [queryClient] = React.useState(() => initQueryClient(addToast));

	return (
		<React.StrictMode>
			<QueryClientProvider client={queryClient}>
				<CacheProvider value={clientSideEmotionCache}>
					<ThemeProvider theme={theme}>
						<CssBaseline />
						<BrowserRouter>
							<App />
						</BrowserRouter>
					</ThemeProvider>
				</CacheProvider>
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
