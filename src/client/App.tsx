// src/client/App.tsx
import { Routes, Route } from 'react-router';
import { AppInitializer } from './util/AppInitializer.js';
import { CharacterListPageLoader } from './page/character/CharacterListPageLoader.jsx';
import { ChatPageLoader } from './page/ChatPageLoader.jsx';
import { NotFoundPage } from './page/error/NotFoundPage.jsx';
import { RootLayout } from './layout/RootLayout.jsx';
import { CharacterPageLoader } from './page/character/CharacterPageLoader.jsx';
import { routeConstants } from './routeConstants.ts';
import { SuperTokensWrapper } from 'supertokens-auth-react';
import { SessionAuth } from 'supertokens-auth-react/recipe/session/index.js';

export function App() {
	const { CHARACTER, CHAT, ERROR, AUTH } = routeConstants;
	return (
		<SuperTokensWrapper>
			<AppInitializer />
			<Routes>
				<Route path="/" element={<RootLayout />}>
					{/* The index route renders at the parent's path ('/') */}
					<Route index element={<CharacterListPageLoader />} />
					<Route path={`${AUTH}`} />
					<Route path={`${CHARACTER}`} element={<CharacterListPageLoader />} />

					<Route path={`${CHARACTER}/:characterId`} element={<CharacterPageLoader />} />
					<Route
						path={`${CHAT}/:sessionId`}
						element={
							// <SessionAuth>
							<ChatPageLoader />
							// </SessionAuth>
						}
					/>

					{/* Fallback route for any path that doesn't match */}
					<Route path="*" element={<NotFoundPage />} />
				</Route>
			</Routes>
		</SuperTokensWrapper>
	);
}
