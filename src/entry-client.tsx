// src/client/entry-client.tsx
import SuperTokens, { SuperTokensWrapper } from 'supertokens-auth-react';
import EmailPassword from 'supertokens-auth-react/recipe/emailpassword/index.js';
import Session from 'supertokens-auth-react/recipe/session/index.js';

import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { CacheProvider } from '@emotion/react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import { QueryClientProvider } from '@tanstack/react-query';
import { createEmotionCache } from './shared/config/createEmotionCache.js';
import { initQueryClient } from './shared/api/queryClient.js';
import { ToastProvider } from './client/style/ToastProvider.jsx';
import { getTheme } from './client/style/theme.js';
import { App } from './client/App.jsx';
import { ColorMode, ColorModeContext } from './client/style/ColorModeContext.jsx';
import { routeConstants } from './client/routeConstants.js';
import { APPNAME } from '#shared/config/constants.js';

// 1. Initialize SuperTokens BEFORE rendering anything
SuperTokens.init({
	appInfo: {
		appName: APPNAME,
		websiteDomain: import.meta.env.VITE_APP_DOMAIN,
		apiDomain: import.meta.env.VITE_API_DOMAIN,
		apiBasePath: `/${routeConstants.API}/${routeConstants.AUTH}`,
		websiteBasePath: `/${routeConstants.AUTH}`,
	},
	recipeList: [EmailPassword.init(), Session.init()],
});

function ClientApp() {
	const clientSideEmotionCache = createEmotionCache();
	const [queryClient] = useState(initQueryClient);
	const [mode, setMode] = useState<ColorMode>('dark');
	const theme = useMemo(() => getTheme(mode), [mode]);

	const toggleMode = () => setMode((prev) => (prev === 'light' ? 'dark' : 'light'));

	return (
		<React.StrictMode>
			<QueryClientProvider client={queryClient}>
				<ToastProvider>
					<CacheProvider value={clientSideEmotionCache}>
						<ColorModeContext.Provider value={{ mode, setMode, toggleMode }}>
							<ThemeProvider theme={theme}>
								<CssBaseline />
								<BrowserRouter>
									<SuperTokensWrapper>
										<App />
									</SuperTokensWrapper>
								</BrowserRouter>
							</ThemeProvider>
						</ColorModeContext.Provider>
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
ReactDOM.hydrateRoot(container, <ClientApp />);

console.log('React app hydrated on client.');
