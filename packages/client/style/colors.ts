// src/styles/colors.ts

import { Palette, Theme, PaletteColor } from '@mui/material'; // IMPORT PaletteColor

// --- COLOR CONSTANTS ---
export const gold = {
  main: '#D4AF37',
  light: '#F0E68C',
  dark: '#7A5A00',
  shadow: 'rgba(212, 175, 55, 0.6)',
};
export const silver = { main: '#BCC6CC', light: '#EBF4F7', shadow: 'rgba(188, 198, 204, 0.6)' };
export const lightChromeBackground = 'rgba(246, 241, 230, 0.82)';

// --- TYPE DEFINITION ---
export interface ColorSet {
  main: string;
  light: string;
}

type AppPalette = Palette & { logo: ColorSet };

export type ColorVariant = keyof Palette | 'gold' | 'silver' | 'logo' | 'default';

// --- PALETTES ---
export const darkPalette = {
  primary: { main: '#00A9FF', light: '#A0E9FF' },
  secondary: { main: '#A0E9FF', light: '#00A9FF' },
  logo: { main: '#FFF', light: '#00A9FF' },
  background: { default: '#0A0A0A', paper: 'rgba(10, 10, 10, 0.5)' },
  text: { primary: '#E0E0E0', secondary: '#BDBDBD' },
};
export const lightPalette = {
  primary: gold,
  secondary: { main: gold.dark, light: gold.light },
  logo: { main: gold.dark, light: gold.light },
  background: { default: '#F7F4ED', paper: 'rgba(255, 255, 255, 0.7)' },
  text: { primary: '#212B36', secondary: '#637381' },
};

// --- UTILITY FUNCTION ---
export const getColorSet = (theme: Theme, colorVariant: ColorVariant = 'default'): ColorSet => {
  if (colorVariant === 'gold') return gold;
  if (colorVariant === 'silver') return silver;
  if (colorVariant === 'logo') return (theme.palette as AppPalette).logo;

  if (colorVariant in theme.palette) {
    const colorObject = theme.palette[colorVariant as keyof Palette];

    if (typeof colorObject === 'object' && 'main' in colorObject && 'light' in colorObject) {
      const paletteColor = colorObject as PaletteColor;
      return { main: paletteColor.main, light: paletteColor.light };
    }
  }

  return theme.palette.mode === 'light'
    ? { main: theme.palette.primary.dark, light: theme.palette.primary.light }
    : { main: theme.palette.text.primary, light: theme.palette.primary.main };
};

export const getColor = (theme: Theme, colorVariant?: ColorVariant, shade: keyof ColorSet = 'main'): string => {
  return getColorSet(theme, colorVariant)[shade];
};
