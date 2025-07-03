import React, { createContext, useContext } from 'react';

export type ColorMode = 'light' | 'dark';

export const ColorModeContext = createContext<{
	mode: ColorMode;
	setMode: (mode: ColorMode) => void;
	toggleMode: () => void;
}>({ mode: 'light', setMode: () => {}, toggleMode: () => {} });

export const useColorMode = () => useContext(ColorModeContext);
