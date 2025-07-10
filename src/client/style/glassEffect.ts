// src/styles/effects.ts

/**
 * A reusable style object for creating a glassmorphism effect with an embossed edge.
 * Can be spread into the `sx` prop or a `styled()` component.
 */
export const glassEffect = {
	background: 'rgba(30, 35, 48, 0.5)', // A darker, blue-tinted semi-transparent background
	backdropFilter: 'blur(10px)',
	WebkitBackdropFilter: 'blur(10px)', // For Safari

	// A subtle border that catches the "light"
	border: '1px solid rgba(255, 255, 255, 0.1)',

	// The core embossing effect using inset shadows
	boxShadow: `
    inset 1px 1px 1px rgba(255, 255, 255, 0.1),
    inset -1px -1px 1px rgba(0, 0, 0, 0.2)
  `,
};
