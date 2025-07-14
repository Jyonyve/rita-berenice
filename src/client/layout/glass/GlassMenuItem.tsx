// src/client/layout/glass/GlassMenuItem.tsx

import { MenuItem, styled, alpha, MenuItemProps } from '@mui/material';
// We assume a color utility exists, similar to the one for GlassButton
import { getColor, ColorVariant } from '../../style/colors.js';

// Define the custom props our component will accept, including colorVariant
interface GlassMenuItemProps extends MenuItemProps {
	colorVariant?: ColorVariant;
}

/**
 * A styled MenuItem with a "glassy" outer glow on hover.
 * The glow color is controlled by the `colorVariant` prop, which
 * defaults to 'primary' for standard actions.
 */
export const GlassMenuItem = styled(MenuItem, {
	// Ensure the custom prop isn't passed down to the DOM
	shouldForwardProp: (prop) => prop !== 'colorVariant',
})<GlassMenuItemProps>(({ theme, colorVariant = 'primary' }) => {
	// THE FIX: Get the glow color dynamically based on the colorVariant prop.
	const glowColor = getColor(theme, colorVariant);

	return {
		fontSize: '0.875rem',
		borderRadius: theme.shape.borderRadius,
		transition: 'box-shadow 0.2s ease-in-out',
		backgroundColor: 'transparent',

		// The hover state now uses the dynamic glow color
		'&:hover': { backgroundColor: 'transparent', boxShadow: `0 0 8px 2px ${alpha(glowColor, 0.6)}` },
	};
});
