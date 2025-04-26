// src/client/App.tsx
import { Routes, Route } from 'react-router-dom';
import { CssBaseline } from '@mui/material'; // Only CssBaseline needed here

// Import your page components

// import { NotFoundPage } from '@client/component/page/NotFoundPage.tsx'; // Example 404
import { CharacterPage, ChatPage } from '@client/component/index.ts';

export function App() {
	return (
		<>
			{/* Use Fragment or a root div if needed */}
			{/* CssBaseline applies resets based on the theme provided by an ancestor ThemeProvider */}
			<CssBaseline />
			{/* --- Routing Setup --- */}
			<Routes>
				{/* Map paths to your page components */}
				<Route path="/" element={<CharacterPage />} />

				{/* Character Routes */}
				<Route path="/character" element={<CharacterPage />} />
				{/* Add routes for /character/new etc. if needed */}

				{/* Chat Route */}
				<Route
					path="/chat/:sessionId"
					element={<ChatPage sessionId={'monday_original_4addb91c-5733-4bf3-8142-a0ab98d0fd9e'} />}
				/>

				{/* Catch-all route for 404 Not Found */}
				{/* <Route path="*" element={<NotFoundPage />} /> */}
			</Routes>
		</>
	);
}
