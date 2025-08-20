// src/components/ui/GlassMetallicIconButton.tsx

import { IconButton, styled } from '@mui/material';
import { getGlassEffect } from '../../style/glassEffect.js';
import { ColorVariant, getColor, gold, silver } from '../../style/colors.js';

interface GlassMetallicIconButtonProps {
	colorVariant?: ColorVariant;
	glowColorVariant?: ColorVariant;
}

export const GlassMetallicIconButton = styled(IconButton, {
	shouldForwardProp: (prop) => prop !== 'colorVariant' && prop !== 'glowColorVariant',
})<GlassMetallicIconButtonProps>(({ theme, colorVariant = 'primary', glowColorVariant }) => {
	const baseGlassStyle = getGlassEffect(theme.palette.mode);

	// Determine colors for the BORDER (based on colorVariant)
	let borderColors;
	if (colorVariant === 'gold') {
		borderColors = gold;
	} else if (colorVariant === 'silver') {
		borderColors = silver;
	} else {
		const mainColor = getColor(theme, colorVariant);
		borderColors = { main: mainColor, light: mainColor, shadow: mainColor };
	}

	// Determine colors for the GLOW (based on glowColorVariant, falling back to colorVariant)
	const finalGlowVariant = glowColorVariant || colorVariant;
	let glowColors;
	if (finalGlowVariant === 'gold') {
		glowColors = gold;
	} else if (finalGlowVariant === 'silver') {
		glowColors = silver;
	} else {
		const mainColor = getColor(theme, finalGlowVariant);
		glowColors = { main: mainColor, light: mainColor, shadow: mainColor };
	}

	return {
		// --- Base Styles ---
		...baseGlassStyle,
		width: '40px',
		height: '40px',
		padding: 0,
		backgroundColor: 'transparent',
		// THE FIX: Use a standard, robust border that respects the radius.
		border: `1px solid ${borderColors.main}`,
		borderRadius: '50%',
		color: borderColors.main, // Icon color inherits this by default
		transition: 'all 0.3s ease-in-out',

		// --- Hover State ---
		'&:hover': {
			...baseGlassStyle['&:hover']!,
			// The glow now correctly uses the independent glowColors
			boxShadow: `0 0 16px ${glowColors.shadow}`,

			'& .MuiSvgIcon-root': { filter: `drop-shadow(0 0 5px ${glowColors.light})` },
		},
		'& .MuiSvgIcon-root': { transition: 'filter 0.5s ease-in-out, color 0.3s ease-in-out' },
	};
});
