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

export const getTheme = (mode: 'light' | 'dark') =>
	createTheme({
		palette: { mode, ...(mode === 'dark' ? darkPalette : lightPalette) },
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

					// --- MAIN SCROLLBAR HIDING ---
					'main::-webkit-scrollbar': { display: 'none' },
					main: { '-ms-overflow-style': 'none', 'scrollbar-width': 'none' },

					// --- GLOBAL PAGE CONTAINER STYLE ---
					'.paper': {
						display: 'flex',
						flexDirection: 'column',
						width: '100%',
						minHeight: '100%',
						marginInline: 'auto',
					},

					// --- NEW: GLOBAL CLASS FOR HIDING SCROLLBARS ---
					// This will hide the scrollbar on any element with className="hide-scrollbar"
					'.hide-scrollbar::-webkit-scrollbar': { display: 'none' },
					'.hide-scrollbar': {
						'-ms-overflow-style': 'none', // IE and Edge
						'scrollbar-width': 'none', // Firefox
					},
				},
			},
		},
	});
