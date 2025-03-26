import { StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import App from './App';

// Client-side hydration
hydrateRoot(
	document.getElementById('root') as HTMLElement,
	<StrictMode>
		<App />
	</StrictMode>
);
