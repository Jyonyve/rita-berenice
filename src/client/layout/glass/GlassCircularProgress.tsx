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
		? { filter: `drop-shadow(0 0 3px ${glowColor}) drop-shadow(0 0 6px ${glowColor})` }
		: {};

	return (
		<Box
			sx={{
				display: 'inline-flex',
				// Apply the glow effect to the wrapping box
				...glowStyle,

				// Set the color of the Box, which the CircularProgress will inherit.
				color: glowColor,

				// Allow for custom styles to be passed in
				...sx,
			}}
		>
			<CircularProgress
				// The spinner will now inherit the glowColor from the parent Box.
				color="inherit"
				// Pass down all other props like `size`, `thickness`, etc.
				{...rest}
			/>
		</Box>
	);
};
