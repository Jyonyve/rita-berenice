import React, { FC } from 'react';
import { Box, CircularProgress, CircularProgressProps, useTheme } from '@mui/material';
import { ColorVariant, getColor } from '../../style/colors.js';

interface GlassCircularProgressProps extends CircularProgressProps {
	colorVariant?: ColorVariant;
	glow?: boolean;
}

export const GlassCircularProgress: FC<GlassCircularProgressProps> = ({
	colorVariant = 'primary',
	glow = true,
	sx,
	...rest
}) => {
	const theme = useTheme();
	const glowColor = getColor(theme, colorVariant);

	// Define the glow style using the drop-shadow filter
	const glowStyle = glow
		? {
				// The drop-shadow filter traces the shape of the SVG, creating a perfect glow.
				filter: `drop-shadow(0 0 3px ${glowColor}) drop-shadow(0 0 6px ${glowColor})`,
			}
		: {};

	return (
		<Box
			sx={{
				display: 'inline-flex',
				// Apply the glow effect to the wrapping box
				...glowStyle,
				// Allow for custom styles to be passed in
				...sx,
			}}
		>
			<GlassCircularProgress
				// The underlying spinner's color can be set to inherit,
				// or you can customize it further if needed.
				color="inherit"
				// Pass down all other props like `size`, `thickness`, etc.
				{...rest}
			/>
		</Box>
	);
};
