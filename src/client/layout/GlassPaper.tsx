// src/components/ui/GlassPaper.tsx
import { Paper, styled } from '@mui/material';

export const GlassPaper = styled(Paper)(({ theme }) => ({
	// --- Core Glassmorphism Styles (from before) ---
	background: 'rgba(255, 255, 255, 0.05)',
	backdropFilter: 'blur(10px)',
	WebkitBackdropFilter: 'blur(10px)', // Safari support
	borderRadius: theme.shape.borderRadius,
	transition: 'all 0.3s ease-in-out', // Smooth transition for hover effects

	// --- The New Embossing Effect ---

	// 1. A very faint outer border to help define the edge.
	// We make it slightly more pronounced than before.
	border: '1px solid rgba(255, 255, 255, 0.1)',

	// 2. Multi-layered inset shadows create the 3D look.
	// This is the core of the embossing effect.
	boxShadow: `
    inset 1px 1px 1px rgba(255, 255, 255, 0.1), /* Top-left highlight */
    inset -1px -1px 1px rgba(0, 0, 0, 0.2)      /* Bottom-right shadow */
  `,

	// --- Optional: Enhance on Hover ---
	'&:hover': {
		background: 'rgba(255, 255, 255, 0.1)', // Slightly lighten the background
		boxShadow: `
      inset 1px 1px 2px rgba(255, 255, 255, 0.2), /* Stronger highlight */
      inset -1px -1px 2px rgba(0, 0, 0, 0.3)      /* Deeper shadow */
    `,
	},
}));
