// src/client/context/AppProviders.tsx

import React, { FC, ReactNode, useMemo, useState } from 'react';
import { SuperTokensWrapper } from 'supertokens-auth-react';
import { QueryClientProvider } from '@tanstack/react-query';
import { CssBaseline, GlobalStyles, ThemeProvider } from '@mui/material';
import { CacheProvider, EmotionCache } from '@emotion/react';

import { ToastProvider } from './provider/ToastProvider.jsx';
import { ColorModeProvider, useColorMode } from './provider/ColorModeProvider.jsx';
import { AuthModalProvider } from './provider/AuthModalProvider.jsx';
import { LanguageProvider } from './provider/LanguageProvider.jsx';
import { getTheme, globalStyle } from './style/globalStyle.js';
import { initQueryClient } from '#shared/api/queryClient.js';

// Define the props for our provider component
interface AppProvidersProps {
	children: ReactNode;
	emotionCache: EmotionCache; // This prop makes the component reusable
}

// Helper component to bridge ColorModeContext to ThemeProvider
const ThemedAppContent: FC<{ children: ReactNode }> = ({ children }) => {
	const { mode } = useColorMode();
	const theme = useMemo(() => getTheme(mode), [mode]);

	return (
		<ThemeProvider theme={theme}>
			<CssBaseline />
			<GlobalStyles styles={globalStyle} />
			{children}
		</ThemeProvider>
	);
};

// This is the main provider component you will export and use.
export const AppProviders: FC<AppProvidersProps> = ({ children, emotionCache }) => {
	const [queryClient] = useState(initQueryClient);

	return (
		<React.StrictMode>
			<QueryClientProvider client={queryClient}>
				<CacheProvider value={emotionCache}>
					<ToastProvider>
						<AuthModalProvider>
							<LanguageProvider>
								<ColorModeProvider>
									<ThemedAppContent>
										<SuperTokensWrapper>{children}</SuperTokensWrapper>
									</ThemedAppContent>
								</ColorModeProvider>
							</LanguageProvider>
						</AuthModalProvider>
					</ToastProvider>
				</CacheProvider>
			</QueryClientProvider>
		</React.StrictMode>
	);
};
