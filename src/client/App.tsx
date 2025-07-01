// src/client/App.tsx
import { Routes, Route } from 'react-router';
import { RootLayout } from './layout/index.js';
import { CharacterPageLoader, ChatPageLoader, NotFoundPage } from './page/index.js';

export function App() {
	return (
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
	);
}
