// src/styles/theme.ts

import { alpha, createTheme, Theme } from '@mui/material/styles';
import { typography } from './typography.js';
import { darkPalette, lightPalette } from './colors.js';
import { chatStyles } from './chatStyles.ts';

// --- THEME CREATION ---

export const getGlobalScrollbarStyles = (theme: Theme) => ({
	'*': {
		scrollbarWidth: 'thin',
		scrollbarColor: `${alpha(theme.palette.text.primary, 0.28)} transparent`,
		'&::-webkit-scrollbar': { width: 6, height: 6 },
		'&::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
		'&::-webkit-scrollbar-thumb': {
			backgroundColor: alpha(theme.palette.text.primary, 0.22),
			borderRadius: 999,
			border: '1px solid transparent',
			backgroundClip: 'padding-box',
		},
		'&:hover::-webkit-scrollbar-thumb': { backgroundColor: alpha(theme.palette.text.primary, 0.38) },
		'&::-webkit-scrollbar-thumb:active': { backgroundColor: alpha(theme.palette.text.primary, 0.52) },
		'&::-webkit-scrollbar-corner': { backgroundColor: 'transparent' },
	},
});

export const getTheme = (mode: 'light' | 'dark') => {
	const theme = createTheme({
		palette: { mode, ...(mode === 'dark' ? darkPalette : lightPalette) },
		typography,
		transitions: {
			duration: {
				shortest: 150,
				shorter: 200,
				short: 250,
				standard: 300,
				complex: 375,
				enteringScreen: 225,
				leavingScreen: 195,
			},
		},
	});

	return createTheme(theme, {
		components: {
			MuiTextField: {
				defaultProps: { size: 'small', variant: 'outlined' },
				styleOverrides: {
					root: {
						'& .MuiInputBase-input': {
							fontSize: theme.typography.body2.fontSize, // Uses body2 from your theme
						},
						'& .MuiInputBase-input::placeholder': {
							fontSize: theme.typography.body2.fontSize,
							opacity: 0.7,
						},

						// MUI 충돌로 TextField 크기조정 제외
						// '& .MuiInputBase-root.MuiInputBase-multiline textarea': {
						// 	resize: 'vertical',
						// 	// Use !important to override inline styles

						// 	// On mobile, disable resizing
						// 	[theme.breakpoints.down('md')]: { resize: 'none' },
						// },
					},
				},
			},
			MuiFormControl: { defaultProps: { size: 'small' } },
			MuiSelect: { styleOverrides: { select: { fontSize: theme.typography.body2.fontSize } } },
			MuiMenuItem: { styleOverrides: { root: { fontSize: theme.typography.body2.fontSize } } },
			MuiAutocomplete: {
				styleOverrides: {
					input: { fontSize: theme.typography.body2.fontSize },
					option: { fontSize: theme.typography.body2.fontSize },
				},
			},
			MuiInputLabel: {
				styleOverrides: {
					root: { fontSize: theme.typography.body2.fontSize },
					shrink: { fontSize: theme.typography.body2.fontSize },
				},
			},
			MuiCssBaseline: {
				styleOverrides: {
					...getGlobalScrollbarStyles(theme),
					// --- BASE & BOX-SIZING ---
					'*, *::before, *::after': {
						boxSizing: 'border-box',
						// Add smooth transitions to all elements
						transition: 'background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease',
					},
					html: { height: '100%', margin: 0, padding: 0 },
					body: {
						height: '100%',
						margin: 0,
						padding: 0,
						backgroundColor: theme.palette.mode === 'dark' ? '#1a1a1a' : theme.palette.background.default,
						// Chat entries sit directly on the character portrait in book mode, so they
						// carry a drop shadow instead of a backdrop blur. Dark mode needs a much
						// heavier shadow: light text over a photo has far less inherent contrast.
						'--chat-text-shadow':
							theme.palette.mode === 'dark'
								? '0 1px 3px rgba(0, 0, 0, 0.85), 0 0 10px rgba(0, 0, 0, 0.55)'
								: '0 1px 2px rgba(255, 255, 255, 0.75), 0 1px 3px rgba(0, 0, 0, 0.22)',
						// Smooth background transition
						transition: 'background-color 0.3s ease',
					},
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
						width: '100%',
						minHeight: '100%',
						padding: theme.spacing(2),
						overflow: 'visible',
						display: 'flex',
						flexDirection: 'column',
						position: 'relative',
					},

					'.hide-scrollbar::-webkit-scrollbar': { display: 'none' },
					'.hide-scrollbar': {
						msOverflowStyle: 'none', // Correct: camelCase for -ms-overflow-style
						scrollbarWidth: 'none', // Correct: camelCase for scrollbar-width
					},

					// --- CHAT COMPONENT STYLES ---
					...chatStyles,
				},
			},
		},
	});
};
