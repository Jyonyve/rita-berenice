// src/components/ui/MetallicGlassButton.tsx

import { Button, Palette, styled } from '@mui/material';
import { getGlassEffect, glassEffect, glassEffectLight } from '../style/glassEffect.js';
import { ColorVariant, getColor, gold, silver } from '../style/colors.js';

// The props interface now uses the unified 'ColorVariant' type
interface MetallicGlassButtonProps {
	colorVariant?: ColorVariant;
}

export const MetallicGlassButton = styled(Button, {
	shouldForwardProp: (prop) => prop !== 'colorVariant',
	// Set a default colorVariant, so the button is visually appealing by default
})<MetallicGlassButtonProps>(({ theme, colorVariant = 'primary' }) => {
	const baseGlassStyle = getGlassEffect(theme.palette.mode);
	// Determine the color set for the metallic effects
	let metallicColors;
	if (colorVariant === 'gold') {
		metallicColors = gold;
	} else if (colorVariant === 'silver') {
		metallicColors = silver;
	} else {
		// For all other MUI colors, derive the effect colors from the theme
		const mainColor = getColor(theme, colorVariant);
		metallicColors = {
			main: mainColor,
			// For non-metallic colors, the 'light' highlight can be the same as the main color
			light: mainColor,
			shadow: mainColor,
		};
	}

	return {
		...baseGlassStyle,
		backgroundColor: 'transparent',
		border: '1px solid',
		borderColor: metallicColors.main,
		color: metallicColors.main, // Text color matches the border/glow
		transition: 'all 0.7s ease-in-out',

		'&:hover': {
			...baseGlassStyle['&:hover'],
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
