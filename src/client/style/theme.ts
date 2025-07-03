import { createTheme } from '@mui/material/styles';

export const getTheme = (mode: 'light' | 'dark') =>
	createTheme({
		palette: {
			mode,
			...(mode === 'light'
				? {
						primary: { main: '#1976d2' },
						secondary: { main: '#dc004e' },
						// background: { default: '#fff', paper: '#fff' }
					}
				: {
						primary: { main: '#90caf9' },
						secondary: { main: '#f48fb1' },
						// background: { default: '#121212', paper: '#121212' }
					}),
		},
		// Add typography, components, etc. here as needed
	});
