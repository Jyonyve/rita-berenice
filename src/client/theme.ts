import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
	// Remove the top-level palette and mode: 'light' if you want to support both modes
	// palette: {
	//  mode: 'light', // Keeping this would force light mode only
	//	primary: { main: '#1976d2' },
	//	secondary: { main: '#dc004e' },
	// },

	// Use the 'colorSchemes' property to define palettes for different modes [7][4]
	colorSchemes: {
		light: {
			// Palette overrides specifically for light mode
			palette: {
				primary: {
					main: '#1976d2', // Your light mode primary color
					// light, dark, contrastText are calculated automatically if not specified
				},
				secondary: {
					main: '#dc004e', // Your light mode secondary color
				},
				// You can add other light-mode specific overrides like background, text etc.
				// background: { default: '#fff', paper: '#fff' }
			},
		},
		dark: {
			// Palette overrides specifically for dark mode
			palette: {
				primary: {
					main: '#90caf9', // Your dark mode primary color
				},
				secondary: {
					// Define a dark mode secondary color if desired
					main: '#f48fb1', // Example dark secondary from docs [8]
				},
				// MUI adjusts background, text etc. automatically for dark mode
				// but you can override them here too if needed
				// background: { default: '#121212', paper: '#121212' }
			},
		},
	},

	// You can still define global typography, component overrides, etc. here
	// typography: { ... },
	// components: { ... },
});
