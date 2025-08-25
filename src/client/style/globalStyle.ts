// src/styles/theme.ts

import { createTheme } from '@mui/material/styles';
import { typography } from './typography.js';

// --- PALETTES ---

const darkPalette = {
	primary: { main: '#00A9FF' },
	secondary: { main: '#A0E9FF' },
	background: { default: '#0A0A0A', paper: 'rgba(10, 10, 10, 0.5)' },
	text: { primary: '#E0E0E0', secondary: '#BDBDBD' },
};

const lightPalette = {
	primary: { main: '#007AB8' },
	secondary: { main: '#0091ea' },
	background: { default: '#F4F6F8', paper: 'rgba(255, 255, 255, 0.7)' },
	text: { primary: '#212B36', secondary: '#637381' },
};

// --- THEME CREATION ---

export const getTheme = (mode: 'light' | 'dark') => {
	const theme = createTheme({
		palette: { mode, ...(mode === 'dark' ? darkPalette : lightPalette) },
		typography: typography,
	});

	return createTheme(theme, {
		components: {
			MuiTextField: {
				defaultProps: { size: 'small', variant: 'outlined' },
				styleOverrides: {
					root: {
						// Target the placeholder pseudo-element
						'& .MuiInputBase-input::placeholder': {
							fontSize: theme.typography.body2.fontSize,
							opacity: 0.7, // Adjust placeholder opacity if needed
						},
					},
				},
			},
			MuiFormControl: { defaultProps: { size: 'small' } },
			MuiInputLabel: {
				styleOverrides: {
					root: { fontSize: theme.typography.body2.fontSize },
					// Ensure the shrinked label is also the correct size
					shrink: { fontSize: theme.typography.body2.fontSize },
				},
			},
			MuiCssBaseline: {
				styleOverrides: {
					// --- BASE & BOX-SIZING ---
					'*, *::before, *::after': { boxSizing: 'border-box' },
					html: { height: '100%', margin: 0, padding: 0 },
					body: { height: '100%', margin: 0, padding: 0 },
					'#root': { height: '100%' },
					"[role='button']": { cursor: 'pointer' },

					// --- MAIN CONTENT AREA STYLE ---
					main: {
						// Apply padding here. This creates the permanent 16px gap that
						// will always be visible around the scrolling .paper.
						padding: theme.spacing(2),
						[theme.breakpoints.down('md')]: { padding: 0 },

						// Hide the scrollbar visuals on the main element itself
						'&::-webkit-scrollbar': { display: 'none' },
						msOverflowStyle: 'none', // IE and Edge
						scrollbarWidth: 'none', // Firefox
					},

					// --- REVISED GLOBAL PAGE CONTAINER STYLE ---
					'.paper': {
						// Fill the available width inside the padded 'main' container.
						width: '100%',

						// This is key: The paper should be at least as tall as its container.
						// If its content makes it taller, it will push past 100% and
						// trigger the parent 'main' element to scroll.
						minHeight: '100%',

						// Add 16px of *inner* padding. This fixes the issue of child
						// components overflowing the paper's borders.
						padding: theme.spacing(2),

						// Ensure the paper itself does not scroll or hide its content.
						// Its children are now contained by the padding above.
						overflow: 'visible',

						// Flex properties to arrange the content *inside* the paper.
						display: 'flex',
						flexDirection: 'column',
						position: 'relative',
					},

					'.hide-scrollbar::-webkit-scrollbar': { display: 'none' },
					'.hide-scrollbar': {
						msOverflowStyle: 'none', // Correct: camelCase for -ms-overflow-style
						scrollbarWidth: 'none', // Correct: camelCase for scrollbar-width
					},
				},
			},
		},
	});
};
