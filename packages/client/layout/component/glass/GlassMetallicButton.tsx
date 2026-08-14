// src/components/ui/MetallicGlassButton.tsx

import { Button, ButtonProps, Palette, styled } from '@mui/material';
import { getGlassEffect, glassEffect, glassEffectLight } from '../../../style/glassEffect.js';
import { ColorVariant, getColor, gold, silver } from '../../../style/colors.js';
import { ComponentType } from 'react';

// The props interface now uses the unified 'ColorVariant' type
interface GlassMetallicButtonProps extends ButtonProps {
	colorVariant?: ColorVariant;
}

export const GlassMetallicButton: ComponentType<GlassMetallicButtonProps> = styled(Button, {
	shouldForwardProp: (prop) => prop !== 'colorVariant',
	// Set a default colorVariant, so the button is visually appealing by default
})<GlassMetallicButtonProps>(({ theme, colorVariant = 'primary' }) => {
	const baseGlassStyle = getGlassEffect(theme.palette.mode, { noGlow: true });

	let metallicColors;
	if (colorVariant === 'gold') {
		metallicColors = gold;
	} else if (colorVariant === 'silver') {
		metallicColors = silver;
	} else {
		const mainColor = getColor(theme, colorVariant);
		metallicColors = { main: mainColor, light: mainColor, shadow: mainColor };
	}

	return {
		...baseGlassStyle,
		backgroundColor: 'transparent',
		border: '1px solid',
		borderColor: metallicColors.main,
		color: metallicColors.main, // Text color matches the border/glow
		transition: 'all 0.7s ease-in-out',

		'&:hover': {
			...baseGlassStyle,
			// Apply the gradient border ONLY for gold and silver variants
			borderImageSlice: colorVariant === 'gold' || colorVariant === 'silver' ? 1 : undefined,
			borderImageSource:
				colorVariant === 'gold' || colorVariant === 'silver'
					? `linear-gradient(to right, ${metallicColors.light}, ${metallicColors.main})`
					: undefined,

			// The glow effect uses the determined shadow color
			boxShadow: `0 0 18px ${metallicColors.shadow}`,
			textShadow: `0 0 10px ${metallicColors.shadow}`,
		},
	};
});
