import { createTheme } from '@mui/material/styles';

export const getTheme = (mode: 'light' | 'dark') =>
	createTheme({
		palette: {
			mode,
			...(mode === 'light'
				? { primary: { main: '#1976d2' }, secondary: { main: '#dc004e' } }
				: { primary: { main: '#90caf9' }, secondary: { main: '#f48fb1' } }),
		},
		components: {
			MuiCssBaseline: {
				styleOverrides: {
					"[role='button']": { cursor: 'pointer' },
					'.container': {
						width: '100vw',
						height: '100vh',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						boxSizing: 'border-box',
					},
					'.paper': {
						width: '100%',
						flexGrow: 1, // Allow the paper to fill the container's height
						display: 'flex',
						flexDirection: 'column',
						overflow: 'hidden', // Prevents content from spilling out
					},
					// The .messagesBody class is no longer needed.
				},
			},
		},
	});
