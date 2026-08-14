// src/styles/effects.ts

import { alpha } from '@mui/material';
import { ColorMode } from '../provider/ColorModeProvider.jsx';
import { silver } from './colors.js';

// src/styles/effects.ts
type GlassInteractionStyle = { background: string; boxShadow: string };

type GlassEffectType = {
	// --- Base Glass Styles ---
	background: string;
	backdropFilter: string;
	WebkitBackdropFilter: string;
	border: string;
	boxShadow: string;
	transition: string;

	// --- Hover State (Subtly Dimmed) ---
	'&:hover'?: GlassInteractionStyle;
	'&:focus-within'?: GlassInteractionStyle;
	'&:active'?: GlassInteractionStyle;
};

interface GlassEffectOptions {
	withHover?: boolean;
	noGlow?: boolean;
}

const addGlow = (style: GlassInteractionStyle, active = false): GlassInteractionStyle => ({
	...style,
	boxShadow: `${style.boxShadow}, ${
		active ? `0 0 18px 3px ${alpha(silver.main, 0.42)}` : `0 0 14px 2px ${alpha(silver.main, 0.32)}`
	}`,
});

/**
 * A reusable style object for creating a DARK MODE glassmorphism effect.
 * Includes a finely-tuned hover effect for balanced interactive feedback.
 */
export const glassEffect = {
	// --- Base Glass Styles ---
	background: 'rgba(30, 35, 48, 0.5)',
	backdropFilter: 'blur(10px)',
	WebkitBackdropFilter: 'blur(10px)',
	border: '1px solid rgba(255, 255, 255, 0.1)',
	boxShadow: `
    inset 1px 1px 1px rgba(255, 255, 255, 0.1),
    inset -1px -1px 1px rgba(0, 0, 0, 0.2)
  `,
	transition: 'all 0.3s ease-in-out',

	// --- Hover State (Subtly Dimmed) ---
	'&:hover': {
		// A slightly darker background color than the previous version.
		background: 'rgba(40, 45, 55, 0.56)',

		// The shadows are subtly softened for a less bright effect.
		boxShadow: `
      inset 1px 1px 2px rgba(255, 255, 255, 0.16), /* A softer highlight */
      inset -1px -1px 2px rgba(0, 0, 0, 0.36)      /* A slightly less deep shadow */
    `,
	},
};

// src/styles/effects.ts (in the same file)

/**
 * A reusable style object for creating a LIGHT MODE glassmorphism effect.
 */
export const glassEffectLight = {
	// --- Base Light Glass Styles ---
	background: 'rgba(255, 255, 255, 0.4)',
	backdropFilter: 'blur(12px)',
	WebkitBackdropFilter: 'blur(12px)',
	border: '1px solid rgba(0, 0, 0, 0.1)',
	boxShadow: `
    inset 1px 1px 1px rgba(0, 0, 0, 0.1),
    inset -1px -1px 1px rgba(255, 255, 255, 0.7)
  `,
	transition: 'all 0.3s ease-in-out',

	// --- Hover State for Light Mode ---
	'&:hover': {
		background: 'rgba(255, 255, 255, 0.6)',
		boxShadow: `
      inset 1px 1px 2px rgba(0, 0, 0, 0.15),
      inset -1px -1px 2px rgba(255, 255, 255, 0.8)
    `,
	},
};

export function getGlassEffect(mode: ColorMode, options?: GlassEffectOptions): GlassEffectType {
	const { withHover = true, noGlow = false } = options || {};

	const baseStyle = mode === 'dark' ? glassEffect : glassEffectLight;
	const { '&:hover': baseHover, ...rest } = baseStyle;

	if (!withHover || !baseHover) return rest;
	if (noGlow) return { ...rest, '&:hover': baseHover };

	const interactionStyle = addGlow(baseHover);
	const activeStyle = addGlow(baseHover, true);

	return {
		...rest,
		'&:hover': interactionStyle,
		'&:focus-within': interactionStyle,
		'&:active': activeStyle,
	};
}
