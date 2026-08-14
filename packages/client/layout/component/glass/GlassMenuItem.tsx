// src/client/layout/glass/GlassMenuItem.tsx

import { MenuItem, styled, alpha, MenuItemProps } from '@mui/material';
import { getColor, ColorVariant } from '../../../style/colors.js';
import { ComponentType } from 'react';

// Define the custom props our component will accept
interface GlassMenuItemProps extends MenuItemProps {
	colorVariant?: ColorVariant;
	compact?: boolean;
	noGlow?: boolean;
}

/**
 * A styled MenuItem with a glassy hover state.
 * The glow color is controlled by the `colorVariant` prop, while `noGlow`
 * preserves the hover feedback without rendering the outer glow.
 * The `compact` prop enables a tighter layout for mobile devices.
 */
export const GlassMenuItem: ComponentType<GlassMenuItemProps> = styled(MenuItem, {
	// Ensure custom props aren't passed down to the DOM
	shouldForwardProp: (prop) => prop !== 'colorVariant' && prop !== 'compact' && prop !== 'noGlow',
})<GlassMenuItemProps>(({ theme, colorVariant = 'primary', compact = false, noGlow = false }) => {
	// Get the glow color dynamically based on the colorVariant prop
	const glowColor = getColor(theme, colorVariant);
	const interactionColor = alpha(glowColor, theme.palette.mode === 'dark' ? 0.12 : 0.08);

	return {
		// Base styling
		fontSize: compact ? '0.875rem' : '0.9375rem',
		borderRadius: theme.shape.borderRadius,
		transition: 'all 0.2s ease-in-out',
		backgroundColor: 'transparent',

		// Responsive padding and sizing
		paddingTop: compact ? theme.spacing(0.75) : theme.spacing(1),
		paddingBottom: compact ? theme.spacing(0.75) : theme.spacing(1),
		paddingLeft: compact ? theme.spacing(1.5) : theme.spacing(2),
		paddingRight: compact ? theme.spacing(1.5) : theme.spacing(2),
		minHeight: compact ? 'auto' : theme.spacing(5),

		// Mobile-specific styling using breakpoints
		[theme.breakpoints.down('md')]: {
			fontSize: '0.875rem',
			paddingTop: theme.spacing(0.75),
			paddingBottom: theme.spacing(0.75),
			paddingLeft: theme.spacing(1.5),
			paddingRight: theme.spacing(1.5),
			minHeight: 'auto',
		},

		// Hover state with dynamic glow color
		'&:hover': {
			backgroundColor: interactionColor,
			boxShadow: noGlow ? 'none' : `0 0 8px 2px ${alpha(glowColor, 0.6)}`,
		},

		// Focus state for accessibility
		'&:focus': {
			backgroundColor: interactionColor,
			boxShadow: noGlow ? 'none' : `0 0 6px 1px ${alpha(glowColor, 0.4)}`,
		},
	};
});
