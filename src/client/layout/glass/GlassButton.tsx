// src/components/ui/GlassButton.tsx

import { Button, Palette, styled } from '@mui/material';
import { getGlassEffect, glassEffect, glassEffectLight } from '../../style/glassEffect.ts';
import { ColorVariant, getColor, gold, silver } from '../../style/colors.ts';

interface GlassButtonProps {
	colorVariant?: ColorVariant;
}

export const GlassButton = styled(Button, {
	shouldForwardProp: (prop) => prop !== 'colorVariant',
})<GlassButtonProps>(({ theme, colorVariant = 'default' }) => {
	const baseGlassStyle = getGlassEffect(theme.palette.mode);
	const glowColor = getColor(theme, colorVariant);

	return {
		...baseGlassStyle,
		backgroundColor: 'transparent',
		color: glowColor,
		transition: 'all 0.5s ease-in-out', // Slower transition

		'&:hover': {
			...baseGlassStyle['&:hover'],
			// Edge and text now glow with the selected colorVariant color
			boxShadow: `0 0 8px ${glowColor}`,
			textShadow: `0 0 10px ${glowColor}`, // More radiant text glow
		},
	};
});
