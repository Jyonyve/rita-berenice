// src/client/App.tsx
import { Routes, Route } from 'react-router';
import { RootLayout } from './layout/RootLayout.jsx';
import { routeConstants } from './routeConstants.js';
import { getSuperTokensRoutesForReactRouterDom } from 'supertokens-auth-react/ui/index.js';
import { EmailPasswordPreBuiltUI } from 'supertokens-auth-react/recipe/emailpassword/prebuiltui.js';
import * as reactRouter from 'react-router';
import { useEffect, useState } from 'react';
import { useToast } from './provider/ToastProvider.jsx';
import { setupApiClient } from './util/clientApiHelpers.js';
import { SessionAuth } from 'supertokens-auth-react/recipe/session/index.js';
import {
	CharacterListPageLoader,
	CharacterPageLoader,
	ChatPageLoader,
	EditCharacterPageLoader,
	MainLandingPage,
	NewCharacterPageLoader,
	NewChatPageLoader,
	NotFoundPage,
	HistoryPageLoader,
	UserPageLoader,
	DocumentPage,
} from './page/index.js';
import { useLanguage } from './provider/LanguageProvider.jsx';

export function App() {
	const { CHARACTER, CHAT, USER, HISTORY, DOCUMENT } = routeConstants;
	const { addToast } = useToast();
	const { lang } = useLanguage();
	const [hasMounted, setHasMounted] = useState(false);

	useEffect(() => {
		setHasMounted(true);
		setupApiClient(addToast); // 안전하게 주입
	}, [addToast]);

	return (
		<Routes>
			<Route element={<RootLayout headerMode="site" />}>
				<Route index element={<MainLandingPage />} />
				{hasMounted && getSuperTokensRoutesForReactRouterDom(reactRouter, [EmailPasswordPreBuiltUI])}
				{/* User */}
				<Route
					path={`${USER}`}
					element={
						<SessionAuth>
							<UserPageLoader />
						</SessionAuth>
					}
				/>
				{/* character  */}
				<Route
					path={`${CHARACTER}`}
					element={
						<SessionAuth>
							<CharacterListPageLoader />
						</SessionAuth>
					}
				/>
				<Route
					path={`${CHARACTER}/new`}
					element={
						<SessionAuth>
							<NewCharacterPageLoader />
						</SessionAuth>
					}
				/>
				<Route
					path={`${CHARACTER}/:characterId`}
					element={
						<SessionAuth>
							<CharacterPageLoader />
						</SessionAuth>
					}
				/>
				<Route
					path={`${CHARACTER}/new`}
					element={
						<SessionAuth>
							<NewCharacterPageLoader />
						</SessionAuth>
					}
				/>
				<Route
					path={`${CHARACTER}/edit/:characterId`}
					element={
						<SessionAuth>
							<EditCharacterPageLoader />
						</SessionAuth>
					}
				/>
				{/* character history */}
				<Route
					path={`${HISTORY}/:historyId`}
					element={
						<SessionAuth>
							<HistoryPageLoader />
						</SessionAuth>
					}
				/>
				{/* chat */}
				<Route
					path={`${CHAT}`}
					element={
						<SessionAuth>
							<NewChatPageLoader />
						</SessionAuth>
					}
				/>
				{/* Fallback route for any path that doesn't match */}
				<Route path="*" element={<NotFoundPage />} />
			</Route>
			<Route element={<RootLayout headerMode="session" />}>
				<Route
					path={`${CHAT}/:sessionId`}
					element={
						<SessionAuth>
							<ChatPageLoader />
						</SessionAuth>
					}
				/>
				<Route
					path={`${DOCUMENT}/:sessionId`}
					element={
						<SessionAuth>
							<DocumentPage />
						</SessionAuth>
					}
				/>
			</Route>
		</Routes>
	);
}
