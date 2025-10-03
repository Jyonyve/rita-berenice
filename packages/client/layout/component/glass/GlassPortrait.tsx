import React, { useState, useEffect, useRef, FC } from 'react';
import { Box, BoxProps, SxProps, Theme, useTheme } from '@mui/material';
import { ColorVariant, getColor } from '../../../style/colors.js';
import { useHoverState } from '../index.js';
import { ASPECT_RATIOS } from '@rita-berenice/shared/config';

export interface GlassPortraitProps extends BoxProps {
	imageUrl: string;
	alt?: string;
	colorVariant?: ColorVariant;
	fit?: 'cover' | 'contain';
	aspectRatio?: number;
	hover?: boolean; // The custom prop for controlling hover state
}

export const GlassPortrait: FC<GlassPortraitProps> = (props) => {
	const {
		imageUrl,
		alt = 'Character',
		colorVariant = 'silver',
		fit = 'cover',
		aspectRatio = ASPECT_RATIOS.CHARACTER,
		hover,
		sx = {}, // sx is also destructured to be merged manually
		onMouseEnter,
		onMouseLeave,
		...rest // All other valid BoxProps (like 'className') are in here
	} = props;

	const [isSelfHovering, setIsSelfHovering] = useState(false);
	const hoverFromContext = useHoverState();
	const isHovering = hover !== undefined ? hover : hoverFromContext || isSelfHovering;

	const theme = useTheme();
	const glowColor = getColor(theme, colorVariant);
	const imgRef = useRef<HTMLImageElement>(null);
	const [glowSize, setGlowSize] = useState(18);

	const handleMouseEnter = (event: React.MouseEvent<HTMLDivElement>) => {
		setIsSelfHovering(true); // Internal logic
		if (onMouseEnter) onMouseEnter(event); // Call handler from props if it exists
	};

	const handleMouseLeave = (event: React.MouseEvent<HTMLDivElement>) => {
		setIsSelfHovering(false); // Internal logic
		if (onMouseLeave) onMouseLeave(event); // Call handler from props if it exists
	};

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
		aspectRatio,
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
		// The conditional styling now uses the clean 'hover' variable.
		...(isHovering && glowStyles),
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
		<Box sx={containerSx} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} {...rest}>
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
