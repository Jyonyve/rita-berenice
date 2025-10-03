// src/components/ui/GlassButton.tsx

import { Button, ButtonProps, Palette, styled } from '@mui/material';
import { getGlassEffect, glassEffect, glassEffectLight } from '../../../style/glassEffect.js';
import { ColorVariant, getColor, gold, silver } from '../../../style/colors.js';
import { ComponentType } from 'react';

interface GlassButtonProps extends ButtonProps {
	colorVariant?: ColorVariant;
}

export const GlassButton: ComponentType<GlassButtonProps> = styled(Button, {
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
			...baseGlassStyle,
			// Edge and text now glow with the selected colorVariant color
			boxShadow: `0 0 8px ${glowColor}`,
			textShadow: `0 0 10px ${glowColor}`, // More radiant text glow
		},
	};
});
