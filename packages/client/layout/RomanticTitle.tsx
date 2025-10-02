// src/components/ui/Title.tsx

import React from 'react';
import { Typography, TypographyProps, useTheme } from '@mui/material';
import { logoFontFamily, titleFontFamily } from '../style/typography.js';
import { ColorVariant, getColor } from '../style/colors.js';
import { useHoverState } from './index.js';

// The props interface is correct. We will use 'hover' for clarity.
interface RomanticTitleProps extends TypographyProps {
	colorVariant?: ColorVariant;
	logo?: boolean;
	hover?: boolean; // We can go back to 'hover' as it's cleaner
	noGlow?: boolean;
}

export const RomanticTitle = (props: RomanticTitleProps) => {
	// *** THIS IS THE FIX ***
	// Manually destructure all of your custom props.
	// The '...rest' object will now only contain valid props for the Typography component.
	const { logo, colorVariant, hover, noGlow, sx, ...rest } = props;

	const hoverFromContext = useHoverState();
	const isHovering = hover !== undefined ? hover : hoverFromContext;
	const theme = useTheme();
	const glowColor = getColor(theme, colorVariant || 'primary');
	const glowStyles = { textShadow: `0 0 8px ${glowColor}` };

	return (
		// The 'rest' object is safely passed, as it no longer contains 'hover'.
		<Typography
			{...rest}
			sx={{
				fontFamily: logo ? logoFontFamily : titleFontFamily,
				whiteSpace: 'nowrap',
				transition: 'text-shadow 0.3s ease-in-out',
				...(isHovering && glowStyles),
				...(!noGlow && { '&:hover': glowStyles }),
				...sx,
			}}
		/>
	);
};
