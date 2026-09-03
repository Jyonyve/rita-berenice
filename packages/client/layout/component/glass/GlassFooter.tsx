// src/components/ui/GlassFooter.tsx

import { Box, BoxProps, styled } from '@mui/material';
import { getGlassEffect } from '../../../style/glassEffect.js';
import { lightChromeBackground } from '../../../style/colors.js';
import { ComponentType } from 'react';

/**
 * A glassmorphism-styled Footer component based on MUI's Box.
 * It's designed to be a flexible container for footer content.
 */
export const GlassFooter: ComponentType<BoxProps> = styled(Box)(({ theme }) => ({
  ...getGlassEffect(theme.palette.mode, { noGlow: true }),

  backgroundColor: theme.palette.mode === 'light' ? lightChromeBackground : 'transparent',
  padding: theme.spacing(2),
  marginTop: 'auto', // Helps push the footer to the bottom in flex layouts
  borderRadius: `${theme.shape.borderRadius}px ${theme.shape.borderRadius}px 0 0`, // Optional: round top corners
}));
