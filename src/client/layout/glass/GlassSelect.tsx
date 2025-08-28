// e.g., src/client/layout/glass/GlassSelect.tsx

import { Select, alpha, styled } from '@mui/material';
// Import the raw style objects directly for precise control
import { glassEffect, glassEffectLight } from '../../style/glassEffect.js';

export const GlassSelect = styled(Select)(({ theme }) => {
	// 1. Determine which style object to use based on the current theme mode.
	const styleObject = theme.palette.mode === 'dark' ? glassEffect : glassEffectLight;

	// 2. THE FIX: Explicitly construct the final style object.
	// This ensures the hover styles are used as the default.
	const finalStyle = {
		// Base properties that don't conflict
		backdropFilter: styleObject.backdropFilter,
		WebkitBackdropFilter: styleObject.WebkitBackdropFilter,
		border: styleObject.border,
		transition: styleObject.transition,

		// "Hovered" styles applied as the default appearance
		background: styleObject['&:hover'].background,
		boxShadow: styleObject['&:hover'].boxShadow,
	};

	return {
		// Apply our new, explicitly defined style.
		...finalStyle,

		// --- All component-specific styles remain the same ---
		'& .MuiSelect-select': {
			// FIX: Reduce the font size for a more subtle look.
			// fontSize: theme.typography.caption.fontSize, // e.g., '0.75rem'

			// FIX: Reduce the padding to make the component more compact.
			padding: theme.spacing(1, 1.5), // e.g., 8px 12px

			// Keep enough padding on the right for the dropdown arrow icon.
			paddingRight: theme.spacing(4),

			// Existing styles
			color: theme.palette.text.primary,
		},
		'& .MuiOutlinedInput-notchedOutline': { borderColor: alpha(theme.palette.common.white, 0.2) },
		// The outline border still gets a hover effect for a subtle interactive cue.
		'&:hover .MuiOutlinedInput-notchedOutline': {
			borderColor: alpha(theme.palette.common.white, 0.5),
		},
		'&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.secondary.dark },
		'& .MuiSvgIcon-root': { color: theme.palette.text.secondary },
	};
});
