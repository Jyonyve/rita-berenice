// src/entry-client.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import createCache from '@emotion/cache';
import { CacheProvider, ThemeProvider } from '@emotion/react'; // Use ThemeProvider
import { BrowserRouter } from 'react-router-dom'; // Import BrowserRouter
import { App, theme } from '@client/index.ts';

// Create cache for client-side injection
const emotionCache = createCache({ key: 'emotion-css-cache', prepend: true });

// Define the client-side app structure with providers
function ClientApp() {
	return (
		<CacheProvider value={emotionCache}>
			<ThemeProvider theme={theme}>
				<BrowserRouter>
					{/* Client-side router */}
					<App />
				</BrowserRouter>
			</ThemeProvider>
		</CacheProvider>
	);
}

// Get the root element
const container = document.getElementById('root');
if (!container) {
	throw new Error('Root element #root not found');
}

// Use hydrateRoot for SSR
ReactDOM.hydrateRoot(container, <ClientApp />);
console.log('React app hydrated on client.');
