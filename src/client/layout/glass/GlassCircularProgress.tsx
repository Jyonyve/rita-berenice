import React, { FC } from 'react';
import { Box, CircularProgress, CircularProgressProps, Typography, useTheme } from '@mui/material';
import { ColorVariant, getColor } from '../../style/colors.js';

interface GlassCircularProgressProps extends CircularProgressProps {
	colorVariant?: ColorVariant;
	glow?: boolean;
	seconds?: number;
}

export const GlassCircularProgress: FC<GlassCircularProgressProps> = ({
	colorVariant = 'primary',
	glow = true,
	seconds,
	sx,
	...rest
}) => {
	const theme = useTheme();
	const glowColor = getColor(theme, colorVariant);

	// Define the glow style using the drop-shadow filter
	const glowStyle = glow
		? { filter: `drop-shadow(0 0 3px ${glowColor}) drop-shadow(0 0 6px ${glowColor})` }
		: {};

	return seconds ? (
		<Box sx={{ position: 'relative', display: 'inline-flex', ...glowStyle, color: glowColor, ...sx }}>
			<CircularProgress variant="determinate" color="inherit" {...rest} />
			<Box
				sx={{
					top: 0,
					left: 0,
					bottom: 0,
					right: 0,
					position: 'absolute',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
				}}
			>
				<Typography variant="caption" component="div" color="text.secondary">
					{Math.round(seconds)}s
				</Typography>
			</Box>
		</Box>
	) : (
		<Box sx={{ display: 'inline-flex', ...glowStyle, color: glowColor, ...sx }}>
			<CircularProgress color="inherit" {...rest} />
		</Box>
	);
};
