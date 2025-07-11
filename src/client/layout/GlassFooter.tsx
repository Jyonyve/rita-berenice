// src/components/ui/GlassFooter.tsx

import { Box, styled } from '@mui/material';
import { getGlassEffect } from '../style/glassEffect.js';

/**
 * A glassmorphism-styled Footer component based on MUI's Box.
 * It's designed to be a flexible container for footer content.
 */
export const GlassFooter = styled(Box)(({ theme }) => ({
	...getGlassEffect(theme.palette.mode),

	backgroundColor: 'transparent',
	padding: theme.spacing(2),
	marginTop: 'auto', // Helps push the footer to the bottom in flex layouts
	borderRadius: `${theme.shape.borderRadius}px ${theme.shape.borderRadius}px 0 0`, // Optional: round top corners
}));
