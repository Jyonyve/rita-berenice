// src/components/ui/Title.tsx

import React from 'react';
import { Typography, TypographyProps, useTheme } from '@mui/material';
import { logoFontFamily, titleFontFamily } from '../style/typography.js';
import { ColorVariant, getColor } from '../style/colors.js';

interface RomanticTitleProps extends TypographyProps {
	colorVariant?: ColorVariant;
	logo?: boolean;
	noGlow?: boolean;
}

// This component accepts all the same props as MUI's Typography component.
export const RomanticTitle = (props: RomanticTitleProps) => {
	// Destructure the new prop and the sx prop to handle them separately
	const { logo, colorVariant, noGlow, sx, ...rest } = props;

	const theme = useTheme();
	// Determine the glow color. It defaults to the theme's primary color.
	const glowColor = getColor(theme, colorVariant || 'primary');

	return (
		<Typography
			{...rest} // Pass all remaining props through
			sx={{
				// --- Base Styles ---
				fontFamily: logo ? logoFontFamily : titleFontFamily,
				whiteSpace: 'nowrap', // Default style to prevent line breaks
				transition: 'all 0.5s ease-in-out',
				// --- Hover Effect ---
				'&:hover': !noGlow
					? {
							// The text shadow now uses the dynamic glowColor
							textShadow: `0 0 8px ${glowColor}`,
						}
					: undefined,

				// --- Merging with Custom Styles ---
				...sx, // This allows you to add or override any styles from the parent
			}}
		/>
	);
};
