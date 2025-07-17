// src/client/layout/ScrollGlow.tsx
import React, { FC } from 'react';
import { Box, useTheme, alpha } from '@mui/material';

interface ScrollGlowProps {
	showTop: boolean;
	showBottom: boolean;
	isScrolling: boolean;
	shouldUseMobileLayout: boolean;
}

/**
 * A presentational component that renders a smooth, "bleed-in" glow effect
 * by positioning the gradients outside the visible container.
 */
export const ScrollGlow: FC<ScrollGlowProps> = ({
	showTop,
	showBottom,
	isScrolling,
	shouldUseMobileLayout,
}) => {
	const theme = useTheme();
	const solidBackgroundColor = theme.palette.background.default;

	// Define the height and offset for the glow for easy tweaking.
	const glowHeight = theme.spacing(9); // 64px, a large area for a very soft gradient.
	const glowOffset = theme.spacing(6); // 32px, how much it "bleeds" in from outside.

	return (
		<Box
			sx={{
				position: 'absolute',
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				zIndex: 2,
				pointerEvents: 'none',
				'--top-glow-opacity': showTop && isScrolling ? 1 : 0,
				'--bottom-glow-opacity': showBottom && isScrolling ? 1 : 0,

				'&::before, &::after': {
					content: '""',
					position: 'absolute',
					left: 0,
					right: 0,
					height: glowHeight,
					marginX: shouldUseMobileLayout ? 0 : theme.spacing(1),
					transition: 'opacity 0.3s ease-out',
				},

				'&::before': {
					// THE FIX: Position the element *outside* the top of the container.
					top: `-${glowOffset}`,
					background: `linear-gradient(to bottom, 
                        ${solidBackgroundColor} 50%, 
                        ${alpha(theme.palette.primary.light, 0.3)} 90%, 
                        transparent 100%
                    )`,
					opacity: 'var(--top-glow-opacity)',
				},

				'&::after': {
					// THE FIX: Position the element *outside* the bottom of the container.
					bottom: `-${glowOffset}`,
					background: `linear-gradient(to top, 
                        ${solidBackgroundColor} 50%, 
                        ${alpha(theme.palette.primary.light, 0.3)} 90%, 
                        transparent 100%
                    )`,
					opacity: 'var(--bottom-glow-opacity)',
				},
			}}
		/>
	);
};
