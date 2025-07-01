// src/client/App.tsx
import { Routes, Route } from 'react-router';
import { AppInitializer } from './util/AppInitializer.js';
import { CharacterPageLoader } from './page/CharacterPageLoader.jsx';
import { ChatPageLoader } from './page/ChatPageLoader.jsx';
import { NotFoundPage } from './page/error/NotFoundPage.jsx';
import { RootLayout } from './layout/RootLayout.jsx';

export function App() {
	return (
		<>
			<AppInitializer />
			<Routes>
				<Route path="/" element={<RootLayout />}>
					{/* The index route renders at the parent's path ('/') */}
					<Route index element={<CharacterPageLoader />} />

					{/* Route for a specific chat session */}
					<Route path="chat/:characterId/:profileId" element={<ChatPageLoader />} />

					{/* Fallback route for any path that doesn't match */}
					<Route path="*" element={<NotFoundPage />} />
				</Route>
			</Routes>
		</>
	);
}
