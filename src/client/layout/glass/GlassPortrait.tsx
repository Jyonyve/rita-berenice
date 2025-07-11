// src/components/ui/GlassPortrait.tsx

import React, { FC } from 'react';
import Box from '@mui/material/Box';
import { ColorVariant, getColor } from '../../style/colors.js';
import { alpha, useTheme } from '@mui/material';

interface GlassPortraitProps {
	imageUrl: string;
	alt?: string;
	colorVariant?: ColorVariant; // Add the selectable color prop
}

export const GlassPortrait: FC<GlassPortraitProps> = ({
	imageUrl,
	alt = 'Character',
	colorVariant = 'silver',
}) => {
	const theme = useTheme();
	const glowColor = getColor(theme, colorVariant);

	return (
		// The outer decorative frame
		<Box
			sx={{
				width: '100%',
				borderRadius: 3,
				display: 'block',
				overflow: 'hidden',
				border: '1px solid rgba(255, 255, 255, 0.1)',
				boxShadow: `
					0px 4px 8px rgba(0, 0, 0, 0.3),
					inset 1px 1px 2px rgba(255, 255, 255, 0.15)
				`,
				transition: 'box-shadow 0.5s ease-in-out',

				// The hover state targets the inner image container
				'&:hover': {
					boxShadow: `
						0px 6px 18px ${glowColor},
						inset 1px 1px 2px rgba(255, 255, 255, 0.25)
					`,
					'& > .image-container': {
						// THE CHANGE: A more subtle, refined "lit-up" effect.
						filter: 'brightness(1.15) saturate(1.1) contrast(1.05)',
					},
				},
			}}
		>
			{/* The MUI-native image container */}
			<Box
				component="img"
				className="image-container"
				src={imageUrl}
				alt={alt}
				sx={{
					width: '100%',
					height: 'auto',
					display: 'block',
					transition: 'filter 0.3s ease-in-out',
					filter: 'brightness(1) saturate(1) contrast(1)',
				}}
			/>
		</Box>
	);
};
