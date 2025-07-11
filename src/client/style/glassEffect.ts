// src/styles/effects.ts

import { ColorMode } from '../provider/ColorModeProvider.jsx';

// src/styles/effects.ts

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

	// --- Hover State (Final Tuned Version) ---
	'&:hover': {
		// A background that is a perfect midpoint in brightness.
		background: 'rgba(42, 47, 60, 0.58)',

		// Shadows are enhanced for a crisp, clear effect without being too bright.
		boxShadow: `
      inset 1px 1px 2px rgba(255, 255, 255, 0.18), /* Balanced highlight */
      inset -1px -1px 2px rgba(0, 0, 0, 0.38)      /* Balanced deeper shadow */
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

export function getGlassEffect(mode: ColorMode) {
	return mode === 'dark' ? glassEffect : glassEffectLight;
}
