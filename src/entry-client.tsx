// src/entry-client.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import createCache from '@emotion/cache'; // For Emotion
import { CacheProvider } from '@emotion/react'; // For Emotion
import { App } from './client/App.tsx';

// You might wrap App in context providers or Router here if needed
// e.g., import { BrowserRouter } from 'react-router-dom';

// For Emotion: Create cache for client-side injection
// Ensure key matches the one used in entry-server.tsx if applicable
const emotionCache = createCache({ key: 'emotion-css-cache', prepend: true });

function ClientApp() {
	// Wrap your App component with necessary providers
	return (
		<React.StrictMode>
			<CacheProvider value={emotionCache}>
				{/* If using React Router for client-side navigation: */}
				{/* <BrowserRouter> */}
				<App />
				{/* </BrowserRouter> */}
			</CacheProvider>
		</React.StrictMode>
	);
}

// Get the root element where the app was rendered server-side
const container = document.getElementById('root');

if (!container) {
	throw new Error('Root element #root not found');
}

// Use hydrateRoot to attach React to the existing server-rendered HTML
ReactDOM.hydrateRoot(container, <ClientApp />);

console.log('React app hydrated on client.');
