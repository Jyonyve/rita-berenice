// src/client/style/ColorModeContext.tsx

import React, { createContext, FC, ReactNode, useContext, useState, useMemo } from 'react';

export type ColorMode = 'light' | 'dark';

// The context definition remains the same
const ColorModeContext = createContext<{
  mode: ColorMode;
  setMode: (mode: ColorMode) => void;
  toggleMode: () => void;
}>({
  mode: 'dark', // Default value
  setMode: () => console.warn('setMode called outside of a ColorModeProvider'),
  toggleMode: () => console.warn('toggleMode called outside of a ColorModeProvider'),
});

// The provider component is now implemented
export const ColorModeProvider: FC<{ children: ReactNode }> = ({ children }) => {
  // 1. Add state to hold the current color mode
  const [mode, setMode] = useState<ColorMode>('dark');

  // 2. Implement the toggle function
  const toggleMode = () => {
    setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
  };

  // 3. Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(
    () => ({ mode, setMode, toggleMode }),
    [mode], // The value object will only be recreated if the 'mode' changes
  );

  // 4. Pass the implemented value to the provider
  return <ColorModeContext.Provider value={value}>{children}</ColorModeContext.Provider>;
};

// The custom hook remains the same
export const useColorMode = () => useContext(ColorModeContext);
