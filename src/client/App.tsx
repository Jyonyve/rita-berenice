// src/client/App.tsx
import { Routes, Route } from 'react-router';
import { CharacterListPageLoader } from './page/character/CharacterListPageLoader.jsx';
import { NotFoundPage } from './page/error/NotFoundPage.jsx';
import { RootLayout } from './layout/RootLayout.jsx';
import { CharacterPageLoader } from './page/character/CharacterPageLoader.jsx';
import { routeConstants } from './routeConstants.js';
import { ChatPageLoader } from './page/chat/ChatPageLoader.jsx';
import MainLandingPage from './page/MainLandingPage.jsx';
import { getSuperTokensRoutesForReactRouterDom } from 'supertokens-auth-react/ui/index.js';
import { EmailPasswordPreBuiltUI } from 'supertokens-auth-react/recipe/emailpassword/prebuiltui.js';
import * as reactRouter from 'react-router';
import { useEffect, useState } from 'react';
import { useToast } from './provider/ToastProvider.jsx';
import { setupApiClient } from './util/clientHelpers.js';
import { NewChatPageLoader } from './page/chat/NewChatPageLoader.jsx';
import { AppProviders } from './AppProviders.jsx';

export function App() {
	const { CHARACTER, CHAT, ERROR, AUTH } = routeConstants;
	const { addToast } = useToast();
	const [hasMounted, setHasMounted] = useState(false);

	useEffect(() => {
		setHasMounted(true);
		setupApiClient(addToast); // 안전하게 주입
	}, [addToast]);

	return (
		<Routes>
			<Route path="/" element={<RootLayout />}>
				<Route index element={<MainLandingPage />} />
				{hasMounted && getSuperTokensRoutesForReactRouterDom(reactRouter, [EmailPasswordPreBuiltUI])}
				<Route path={`${CHARACTER}`} element={<CharacterListPageLoader />} />
				<Route path={`${CHARACTER}/:characterId`} element={<CharacterPageLoader />} />
				<Route
					path={`${CHAT}`}
					element={
						// <SessionAuth>
						<NewChatPageLoader />
						// </SessionAuth>
					}
				/>
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
	);
}
