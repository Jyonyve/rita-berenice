// src/client/entry-client.tsx
import SuperTokens from 'supertokens-auth-react';
import EmailPassword from 'supertokens-auth-react/recipe/emailpassword/index.js';
import Session from 'supertokens-auth-react/recipe/session/index.js';
import ReactDOM from 'react-dom/client';
import { App } from './client/App.jsx';
import { routeConstants } from './client/routeConstants.js';
import { APPNAME } from '#shared/config/constants.js';
import React, { FC, ReactNode, useMemo, useState } from 'react';
import { BrowserRouter } from 'react-router';
import { CssBaseline, GlobalStyles } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';

import { ColorModeProvider, useColorMode } from '#client/provider/ColorModeProvider.jsx'; // Using the new standalone provider

import { getTheme } from '#client/style/globalStyle.js';
import { initQueryClient } from '#shared/api/queryClient.js';
import { createEmotionCache } from '#shared/config/createEmotionCache.js';
import { AppProviders } from '#client/AppProviders.jsx';

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

	return (
		<BrowserRouter>
			<AppProviders emotionCache={clientSideEmotionCache}>
				<App />
			</AppProviders>
		</BrowserRouter>
	);
}

const container = document.getElementById('root');

if (!container) {
	throw new Error("Root element '#root' not found for hydration.");
}

// This is React's hydration, and it is ESSENTIAL. It makes the server-rendered HTML interactive.
ReactDOM.hydrateRoot(container, <ClientApp />);

console.log('React app hydrated on client.');
