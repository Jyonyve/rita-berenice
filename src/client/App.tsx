// src/client/App.tsx
import { Routes, Route } from 'react-router';
import { AppInitializer } from './util/Initializers.js';
import { CharacterListPageLoader } from './page/character/CharacterListPageLoader.jsx';
import { NotFoundPage } from './page/error/NotFoundPage.jsx';
import { RootLayout } from './layout/RootLayout.jsx';
import { CharacterPageLoader } from './page/character/CharacterPageLoader.jsx';
import { routeConstants } from './routeConstants.js';
import { SuperTokensWrapper } from 'supertokens-auth-react';
import { ChatPageLoader } from './page/chat/ChatPageLoader.jsx';
import MainLandingPage from './page/MainLandingPage.jsx';
import { getSuperTokensRoutesForReactRouterDom } from 'supertokens-auth-react/ui/index.js';
import { EmailPasswordPreBuiltUI } from 'supertokens-auth-react/recipe/emailpassword/prebuiltui.js';
import * as reactRouter from 'react-router';
import SuperTokens from 'supertokens-auth-react';
import EmailPassword from 'supertokens-auth-react/recipe/emailpassword/index.js';
import Session from 'supertokens-auth-react/recipe/session/index.js';
import { useEffect, useState } from 'react';

export function App() {
	const { CHARACTER, CHAT, ERROR, AUTH } = routeConstants;
	const [routes, setRoutes] = useState<React.ReactNode>(null);

	function clientOnlySuperTokensRoutes() {
		setRoutes(getSuperTokensRoutesForReactRouterDom(reactRouter, [EmailPasswordPreBuiltUI]));
	}

	useEffect(() => {
		clientOnlySuperTokensRoutes();
	}, []);

	return (
		<>
			<AppInitializer />
			<Routes>
				<Route path="/" element={<RootLayout />}>
					<Route index element={<MainLandingPage />} />
					{routes ? routes : null}
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
		</>
	);
}
