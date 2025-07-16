// src/components/ui/Title.tsx

import React from 'react';
import { Typography, TypographyProps, useTheme } from '@mui/material';
import { logoFontFamily, titleFontFamily } from '../style/typography.js';
import { ColorVariant, getColor } from '../style/colors.js';

interface RomanticTitleProps extends TypographyProps {
	colorVariant?: ColorVariant;
	logo?: boolean;
	hover?: boolean;
	/**
	 * If true, the component will not glow on its own hover.
	 * This is useful when a parent component controls the glow state.
	 */
	noGlow?: boolean;
}

export const RomanticTitle = (props: RomanticTitleProps) => {
	// Destructure all custom props
	const { logo, colorVariant, hover, noGlow, sx, ...rest } = props;

	const theme = useTheme();
	const glowColor = getColor(theme, colorVariant || 'primary');
	const glowStyles = { textShadow: `0 0 8px ${glowColor}` };

	return (
		<Typography
			{...rest}
			sx={{
				fontFamily: logo ? logoFontFamily : titleFontFamily,
				whiteSpace: 'nowrap',
				transition: 'text-shadow 0.3s ease-in-out',

				// --- DYNAMIC GLOW LOGIC ---
				// 1. Apply glow if the 'hover' prop is true.
				...(hover && glowStyles),
				// 2. Apply the standalone hover effect ONLY if 'noGlow' is not passed.
				...(!noGlow && { '&:hover': glowStyles }),

				// Merge with any custom styles from the parent
				...sx,
			}}
		/>
	);
};
