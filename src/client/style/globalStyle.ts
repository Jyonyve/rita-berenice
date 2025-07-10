import { createTheme } from '@mui/material/styles';

export const getTheme = (mode: 'light' | 'dark') =>
	createTheme({
		palette: {
			mode,
			...(mode === 'light'
				? { primary: { main: '#1976d2' }, secondary: { main: '#dc004e' } }
				: // : { primary: { main: '#90caf9' }, secondary: { main: '#f48fb1' } }
					{
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
						text: {
							primary: '#E0E0E0', // A light grey for primary text for readability
							secondary: '#BDBDBD', // A slightly dimmer grey for secondary text
						},
					}),
		},
		components: {
			MuiTextField: { defaultProps: { size: 'small' } },
			MuiFormControl: { defaultProps: { size: 'small' } },
			// MuiButton: { defaultProps: { size: 'small' } },
			MuiCssBaseline: {
				styleOverrides: {
					"[role='button']": { cursor: 'pointer' },

					// BOX SIZE
					html: { height: '100%', margin: 0, padding: 0 },
					body: { height: '100%', margin: 0, padding: 0 },
					'#root': { height: '100%' },
					'*, *::before, *::after': { boxSizing: 'border-box' },

					// --- ADD THIS SECTION TO HIDE THE SCROLLBAR ---
					// Target the main scrollable container in your RootLayout
					'main::-webkit-scrollbar': {
						display: 'none', // For Webkit browsers (Chrome, Safari, Edge)
					},
					main: {
						'-ms-overflow-style': 'none', // For Internet Explorer and Edge
						'scrollbar-width': 'none', // For Firefox
					},

					// main background
					'.paper': {
						width: '100%',
						maxWidth: '1200px', // ADDED: A standard max-width for all pages.
						padding: '12px', // ADDED: Consistent padding for all content.
						flexDirection: 'column',
						marginInline: 'auto',
					},
				},
			},
		},
	});
