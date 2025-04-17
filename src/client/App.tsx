import { Routes, Route } from 'react-router-dom'; // Import React Router components

// --- MUI Imports ---
import { CharacterPage, ChatPage } from '@client/component/index.ts';
import { ThemeProvider } from '@emotion/react';
import { CssBaseline } from '@mui/material';
import { createTheme } from '@mui/system';
// import { lightTheme, darkTheme } from './themes'; // Assuming you have theme definitions

// --- Define or Import MUI Theme ---
// Example: Replace with your actual theme configuration
const theme = createTheme({
	palette: {
		mode: 'light', // or 'dark'
		// Add your theme customizations here
	},
});

export function App() {
	return (
		<ThemeProvider theme={theme}>
			d{/* Apply MUI's baseline CSS reset */}
			<CssBaseline />
			{/* --- Routing Setup --- */}
			{/* Define which component to render based on the URL path */}
			<Routes>
				{/* Map paths to your page components */}
				<Route path="/" element={<>Rita-Berenice</>} />

				{/* Character Routes */}
				<Route path="/character" element={<CharacterPage />} />
				{/* Matches /character/some-name */}
				<Route path="/character/:characterName" element={<>character page</>} />
				{/* Add routes for /character/new or update if needed */}
				{/* <Route path="/character/new" element={<CreateCharacterPage />} /> */}
				{/* <Route path="/character/:characterName/edit" element={<UpdateCharacterPage />} /> */}

				{/* Chat Route */}
				{/* Matches /chat/session-abc-123 */}
				<Route path="/chat/:sessionId" element={<ChatPage sessionId="" />} />

				{/* Catch-all route for 404 Not Found */}
				{/* <Route path="*" element={<NotFoundPage />} /> */}
			</Routes>
			{/* You could add common layout components here (e.g., Navbar, Footer) */}
			{/* <Navbar /> */}
			{/* <Footer /> */}
		</ThemeProvider>
	);
}
