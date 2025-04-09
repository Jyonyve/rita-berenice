// src/client/App.tsx
import React from 'react';
import { Routes, Route } from 'react-router-dom'; // Import React Router components

// --- MUI Imports ---
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AiModelComp, CharacterComp, ChatComp } from './component/index.ts';
// import { lightTheme, darkTheme } from './themes'; // Assuming you have theme definitions

// --- Import Your Page Components ---
// You need to create these components based on your UI needs
// import HomePage from './pages/HomePage'; // Example: src/client/pages/HomePage.tsx
// import CharacterListPage from './pages/CharacterListPage'; // Example: src/client/pages/CharacterListPage.tsx
// import CharacterDetailPage from './pages/CharacterDetailPage'; // Example: src/client/pages/CharacterDetailPage.tsx
// import ChatPage from './pages/ChatPage'; // Example: src/client/pages/ChatPage.tsx
// import NotFoundPage from './pages/NotFoundPage'; // Example: src/client/pages/NotFoundPage.tsx

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
			{/* Apply MUI's baseline CSS reset */}
			<CssBaseline />

			{/* --- Routing Setup --- */}
			{/* Define which component to render based on the URL path */}
			<Routes>
				{/* Map paths to your page components */}
				<Route path="/" element={<>home page</>} />

				{/* Character Routes */}
				<Route path="/character" element={<CharacterComp />} />
				{/* Matches /character/some-name */}
				<Route path="/character/:characterName" element={<>character page</>} />
				{/* Add routes for /character/new or update if needed */}
				{/* <Route path="/character/new" element={<CreateCharacterPage />} /> */}
				{/* <Route path="/character/:characterName/edit" element={<UpdateCharacterPage />} /> */}

				{/* Chat Route */}
				{/* Matches /chat/session-abc-123 */}
				<Route path="/chat/:sessionId" element={<ChatComp />} />

				{/* Catch-all route for 404 Not Found */}
				{/* <Route path="*" element={<NotFoundPage />} /> */}
			</Routes>

			{/* You could add common layout components here (e.g., Navbar, Footer) */}
			{/* <Navbar /> */}
			{/* <Footer /> */}
		</ThemeProvider>
	);
}
