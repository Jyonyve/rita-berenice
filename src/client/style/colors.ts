// src/styles/colors.ts

import { Palette, Theme, PaletteColor } from '@mui/material'; // IMPORT PaletteColor

// --- COLOR CONSTANTS ---
export const gold = { main: '#D4AF37', light: '#F0E68C', shadow: 'rgba(212, 175, 55, 0.6)' };

export const silver = { main: '#BCC6CC', light: '#EBF4F7', shadow: 'rgba(188, 198, 204, 0.6)' };

// --- TYPE DEFINITION ---
export type ColorVariant = keyof Palette | 'gold' | 'silver' | 'default';

// --- UTILITY FUNCTION ---
// ADDED export to make the function available in other files
export const getColor = (theme: Theme, colorVariant?: ColorVariant): string => {
	// Handle custom colors first
	if (colorVariant === 'gold') return gold.main;
	if (colorVariant === 'silver') return silver.main;

	// Handle standard MUI palette colors
	if (colorVariant && colorVariant in theme.palette) {
		const colorObject = theme.palette[colorVariant as keyof Palette];

		// Type guard to safely access the '.main' property
		if (typeof colorObject === 'object' && 'main' in colorObject) {
			return (colorObject as PaletteColor).main;
		}
	}

	// Fallback for 'default' or any invalid variant
	return theme.palette.text.primary;
};
