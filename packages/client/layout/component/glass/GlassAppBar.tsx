// src/components/ui/GlassAppBar.tsx

import { AppBar, AppBarProps, styled } from '@mui/material';
import { getGlassEffect } from '../../../style/glassEffect.js'; // Adjust path based on your structure
import { lightChromeBackground } from '../../../style/colors.js';
import { ComponentType } from 'react';

export const GlassAppBar: ComponentType<AppBarProps> = styled(AppBar)(({ theme }) => ({
	...getGlassEffect(theme.palette.mode, { noGlow: true }),

	// Override MUI's default AppBar color to be transparent,
	// allowing the glass effect to be visible.
	backgroundColor: theme.palette.mode === 'light' ? lightChromeBackground : 'transparent',

	// The position is often 'sticky' for AppBars, but this component will respect
	// any position prop you pass to it.
}));
