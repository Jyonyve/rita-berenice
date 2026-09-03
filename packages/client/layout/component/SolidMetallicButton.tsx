// src/components/ui/SolidMetallicButton.tsx

import { Button, styled, alpha, PaletteColor, Palette, ButtonProps } from '@mui/material';
import { getColor, ColorVariant, gold, silver } from '../../style/colors.js';
import { ComponentType } from 'react';

interface SolidMetallicButtonProps extends ButtonProps {
  colorVariant?: ColorVariant;
}

export const SolidMetallicButton: ComponentType<SolidMetallicButtonProps> = styled(Button, {
  shouldForwardProp: (prop) => prop !== 'colorVariant',
})<SolidMetallicButtonProps>(({ theme, colorVariant = 'primary' }) => {
  // 1. Determine the color palette for the button
  let metallicColors;
  if (colorVariant === 'gold') {
    metallicColors = gold;
  } else if (colorVariant === 'silver') {
    metallicColors = silver;
  } else {
    // For all standard MUI colors, derive the effect colors from the theme
    const mainColor = getColor(theme, colorVariant);
    const colorObject = theme.palette[colorVariant as keyof Palette];

    // Safely get the 'light' shade for the hover gradient, or create one
    const lightColor =
      typeof colorObject === 'object' && 'light' in colorObject
        ? (colorObject as PaletteColor).light
        : alpha(mainColor, 0.8);

    metallicColors = { main: mainColor, light: lightColor, shadow: mainColor };
  }

  return {
    // 2. Base styles for the "solid metal" look
    color: theme.palette.common.black, // High-contrast black text
    // A gradient gives the illusion of a curved, metallic surface
    background: `linear-gradient(to bottom, ${metallicColors.main}, ${alpha(metallicColors.main, 0.85)})`,
    // A slightly darker border provides a clean, defined edge
    border: `1px solid ${alpha(metallicColors.main, 0.7)}`,
    transition: 'all 0.05s ease-in-out',
    fontWeight: 'bold',
    // 3. The hover effect to make it shine and glow
    '&:hover': {
      // The gradient becomes brighter, as if catching the light
      background: `linear-gradient(to bottom, ${metallicColors.light}, ${metallicColors.main})`,
      // The signature glow effect
      boxShadow: `0 0 18px ${metallicColors.shadow}`,
    },
  };
});
