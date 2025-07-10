// src/client/context/AppProviders.tsx

import React, { FC, ReactNode, useMemo, useState } from 'react';
import { BrowserRouter } from 'react-router';
import { SuperTokensWrapper } from 'supertokens-auth-react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Box, CssBaseline, ThemeProvider } from '@mui/material';

import { ToastProvider } from './provider/ToastProvider.jsx';
import { ColorModeProvider, useColorMode } from './provider/ColorModeProvider.jsx'; // Using the new standalone provider
import { AuthModalProvider } from './provider/AuthModalProvider.jsx';
import { LanguageProvider } from './provider/LanguageProvider.jsx';
import { getTheme } from './style/globalStyle.js';
import { initQueryClient } from '#shared/api/queryClient.js';
import { createEmotionCache } from '#shared/config/createEmotionCache.js';
import { CacheProvider } from '@emotion/react';

const ThemedAppContent: FC<{ children: ReactNode }> = ({ children }) => {
	const { mode } = useColorMode();
	const theme = useMemo(() => getTheme(mode), [mode]);

	return (
		<ThemeProvider theme={theme}>
			<CssBaseline />
			<Box className="container">{children}</Box>
		</ThemeProvider>
	);
};

// This is the main provider component you will export and use.
export const AppProviders: FC<{ children: ReactNode }> = ({ children }) => {
	const clientSideEmotionCache = createEmotionCache();
	const [queryClient] = useState(initQueryClient);

	return (
		<React.StrictMode>
			<QueryClientProvider client={queryClient}>
				<CacheProvider value={clientSideEmotionCache}>
					<ToastProvider>
						<AuthModalProvider>
							<LanguageProvider>
								<ColorModeProvider>
									<ThemedAppContent>
										<BrowserRouter>
											<SuperTokensWrapper>{children}</SuperTokensWrapper>
										</BrowserRouter>
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
