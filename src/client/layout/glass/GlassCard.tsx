// src/components/ui/GlassCard.tsx

import { Card, styled } from '@mui/material';
import { getGlassEffect } from '../../style/glassEffect.ts'; // Adjust path based on your structure

export const GlassCard = styled(Card)(({ theme }) => ({
	...getGlassEffect(theme.palette.mode),

	// Ensure the card's own background color is fully transparent
	// so the backdrop-filter can "see through" to the content behind it.
	backgroundColor: 'transparent',

	// You can adjust the border-radius here to match your design
	borderRadius: Number(theme.shape.borderRadius) * 2, // Example: double the default radius
}));
