import React, { useState, useEffect, useRef, FC } from 'react';
import { Box, SxProps, Theme, useTheme } from '@mui/material';
import { ColorVariant, getColor } from '../../style/colors.js';

interface GlassPortraitProps {
	imageUrl: string;
	alt?: string;
	className?: string;
	colorVariant?: ColorVariant;
	sx?: SxProps<Theme>;
	fit?: 'cover' | 'contain';
	hover?: boolean;
}

export const GlassPortrait: FC<GlassPortraitProps> = ({
	imageUrl,
	alt = 'Character',
	colorVariant = 'silver',
	className,
	sx = {},
	fit = 'cover',
	hover = false,
}) => {
	const theme = useTheme();
	const glowColor = getColor(theme, colorVariant);
	const imgRef = useRef<HTMLImageElement>(null);
	const [glowSize, setGlowSize] = useState(18);

	useEffect(() => {
		function updateGlowSize() {
			if (imgRef.current) {
				const width = imgRef.current.clientWidth;
				const baseWidth = 600;
				const baseGlow = 18;
				let calculatedGlow = (baseGlow * width) / baseWidth;
				calculatedGlow = Math.max(6, Math.min(calculatedGlow, baseGlow));
				setGlowSize(calculatedGlow);
			}
		}
		updateGlowSize();
		window.addEventListener('resize', updateGlowSize);
		return () => window.removeEventListener('resize', updateGlowSize);
	}, []);

	const glowStyles = {
		boxShadow: `
      0px 6px ${glowSize}px ${glowColor},
      inset 1px 1px 2px rgba(255, 255, 255, 0.25)
    `,
		'& > img': { filter: 'brightness(1.15) saturate(1.1) contrast(1.05)' },
	};

	const containerSx: SxProps<Theme> = {
		aspectRatio: '5 / 7',
		width: '100%',
		height: 'auto',
		position: 'relative',
		display: 'block',
		overflow: 'hidden',
		borderRadius: 3,
		border: '1px solid rgba(255, 255, 255, 0.1)',
		boxShadow: `
      0px 4px 8px rgba(0, 0, 0, 0.3),
      inset 1px 1px 2px rgba(255, 255, 255, 0.15)
    `,
		transition: 'box-shadow 0.5s ease-in-out',
		...(hover && glowStyles),
		'&:hover': glowStyles,
		...sx,
	};

	const imgSx: SxProps<Theme> = {
		display: 'block',
		width: '100%',
		height: '100%',
		objectFit: fit,
		transition: 'filter 0.3s ease-in-out',
		filter: 'brightness(1) saturate(1) contrast(1)',
	};

	return (
		<Box className={className} sx={containerSx}>
			<Box
				component="img"
				className="image-container"
				src={imageUrl}
				alt={alt}
				sx={imgSx}
				ref={imgRef}
			/>
		</Box>
	);
};
