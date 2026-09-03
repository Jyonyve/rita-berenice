// src/client/context/AppProviders.tsx

import React, { FC, ReactNode, useMemo, useState } from 'react';
import { SuperTokensWrapper } from 'supertokens-auth-react';
import { Box, CssBaseline, ThemeProvider } from '@mui/material';
import { CacheProvider, EmotionCache } from '@emotion/react';
import { ToastProvider } from './provider/ToastProvider.jsx';
import { ColorModeProvider, useColorMode } from './provider/ColorModeProvider.jsx';
import { AuthProvider } from './provider/AuthProvider.jsx';
import { LanguageProvider } from './provider/LanguageProvider.jsx';
import { getTheme } from './style/globalStyle.js';
import { LangCode } from '@rita-berenice/shared/config';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Define the props for our provider component
interface AppProvidersProps {
  children: ReactNode;
  emotionCache: EmotionCache; // This prop makes the component reusable
  initialLang?: LangCode;
}

// Helper component to bridge ColorModeContext to ThemeProvider
const ThemedAppContent: FC<{ children: ReactNode }> = ({ children }) => {
  const { mode } = useColorMode();
  const theme = useMemo(() => getTheme(mode), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
};

const initQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1분
        refetchOnWindowFocus: false,
      },
      mutations: {},
    },
  });
};

// This is the main provider component you will export and use.
export const AppProviders: FC<AppProvidersProps> = ({ children, emotionCache, initialLang }) => {
  const [queryClient] = useState(initQueryClient);

  return (
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <SuperTokensWrapper>
          <AuthProvider>
            <CacheProvider value={emotionCache}>
              <LanguageProvider initialLang={initialLang}>
                <ColorModeProvider>
                  <ToastProvider>
                    <ThemedAppContent>{children}</ThemedAppContent>
                  </ToastProvider>
                </ColorModeProvider>
              </LanguageProvider>
            </CacheProvider>
          </AuthProvider>
        </SuperTokensWrapper>
      </QueryClientProvider>
    </React.StrictMode>
  );
};
