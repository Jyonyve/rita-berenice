// src/components/ui/GlassCard.tsx

import { Box, styled } from '@mui/material';
import { glassEffect } from '../style/glassEffect.ts'; // Adjust path based on your structure

export const GlassBox = styled(Box)(({ theme }) => ({
	...glassEffect,

	// Ensure the box's own background color is fully transparent
	backgroundColor: 'transparent',

	// Apply default border-radius or customize as needed
	borderRadius: theme.shape.borderRadius,
}));
