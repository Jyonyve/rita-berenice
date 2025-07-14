// src/components/ui/GlassCard.tsx

import { Box, styled } from '@mui/material';
import { getGlassEffect } from '../../style/glassEffect.js'; // Adjust path based on your structure

export const GlassBox = styled(Box)(({ theme }) => ({
	...getGlassEffect(theme.palette.mode),

	// Ensure the box's own background color is fully transparent
	backgroundColor: 'transparent',

	// Apply default border-radius or customize as needed
	borderRadius: theme.shape.borderRadius,
}));
