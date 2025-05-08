// src/client/entry-client.tsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom'; // Use BrowserRouter for client
import { CacheProvider } from '@emotion/react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { createEmotionCache } from '@shared/config/index.ts'; // Use your shared utility
import { App, theme } from '@client/index.ts'; // Import theme and App

// 1. Create a single client-side cache instance using the shared utility
const clientSideEmotionCache = createEmotionCache();

// Define the client-side app structure with providers (NO HelmetProvider)
function ClientApp() {
	return (
		<React.StrictMode>
			{/* Optional but recommended */}
			<CacheProvider value={clientSideEmotionCache}>
				{/* Emotion wrapper */}
				<ThemeProvider theme={theme}>
					{/* MUI Theme wrapper */}
					<CssBaseline /> {/* MUI CSS reset */}
					<BrowserRouter>
						{/* Router wrapper */}
						<App />
					</BrowserRouter>
				</ThemeProvider>
			</CacheProvider>
		</React.StrictMode>
	);
}

// 2. Get the root element
const container = document.getElementById('root');

if (!container) {
	throw new Error("Root element '#root' not found for hydration.");
}

// 3. Use hydrateRoot for SSR, wrapping with ClientApp which includes providers
ReactDOM.hydrateRoot(container, <ClientApp />);

console.log('React app hydrated on client.');
