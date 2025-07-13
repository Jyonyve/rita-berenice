// src/styles/theme.ts

import { createTheme } from '@mui/material/styles';
import { typography } from './typography.js';

// --- PALETTES ---

// A cohesive dark mode palette
const darkPalette = {
	primary: {
		main: '#00A9FF', // A vibrant, clear blue
	},
	secondary: {
		main: '#A0E9FF', // A lighter blue for accents
	},
	background: {
		default: '#0A0A0A', // A very dark, near-black
		paper: 'rgba(10, 10, 10, 0.5)', // A semi-transparent black for surfaces
	},
	text: { primary: '#E0E0E0', secondary: '#BDBDBD' },
};

// A corresponding light mode palette
const lightPalette = {
	primary: {
		main: '#007AB8', // A slightly deeper blue for better contrast in light mode
	},
	secondary: { main: '#0091ea' },
	background: {
		default: '#F4F6F8', // A very light grey
		paper: 'rgba(255, 255, 255, 0.7)',
	},
	text: { primary: '#212B36', secondary: '#637381' },
};

// --- THEME CREATION ---

export const getTheme = (mode: 'light' | 'dark') =>
	createTheme({
		palette: { mode, ...(mode === 'dark' ? darkPalette : lightPalette) },
		// --- THE NEW TYPOGRAPHY SECTION ---
		typography: typography,

		components: {
			MuiTextField: { defaultProps: { size: 'small' } },
			MuiFormControl: { defaultProps: { size: 'small' } },
			MuiCssBaseline: {
				styleOverrides: {
					// --- BASE & BOX-SIZING ---
					'*, *::before, *::after': { boxSizing: 'border-box' },
					html: { height: '100%', margin: 0, padding: 0 },
					body: { height: '100%', margin: 0, padding: 0 },
					'#root': { height: '100%' },
					"[role='button']": { cursor: 'pointer' },

					// --- SCROLLBAR HIDING ---
					'main::-webkit-scrollbar': { display: 'none' },
					main: { '-ms-overflow-style': 'none', 'scrollbar-width': 'none' },

					// --- GLOBAL PAGE CONTAINER STYLE ---
					'.paper': {
						display: 'flex',
						flexDirection: 'column',
						width: '100%',
						minHeight: '100%',
						// maxWidth: '1200px',
						marginInline: 'auto',
						padding: '16px', // Standardized padding
					},
				},
			},
		},
	});
