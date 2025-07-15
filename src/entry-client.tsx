// src/client/entry-client.tsx
import SuperTokens from 'supertokens-auth-react';
import EmailPassword from 'supertokens-auth-react/recipe/emailpassword/index.js';
import Session from 'supertokens-auth-react/recipe/session/index.js';
import ReactDOM from 'react-dom/client';
import { App } from './client/App.jsx';
import { routeConstants } from './client/routeConstants.js';
import { APPNAME } from '#shared/config/constants.js';
import { BrowserRouter } from 'react-router';
import { createEmotionCache } from '#shared/config/createEmotionCache.js';
import { AppProviders } from '#client/AppProviders.jsx';
import '#client/style/index.css';
import { User } from 'supertokens-web-js/types/index.js';
import { getMockLoggedIn, setMockLoggedIn } from '#client/mock/supertokensMockState.js';

const isStatic = import.meta.env.VITE_APP_MODE === 'static';

if (isStatic) {
	const dummyResponse = new Response(null, { status: 200 });
	const now = Date.now();

	const mockUser: User = {
		id: 'mock-user',
		timeJoined: now,
		isPrimaryUser: false,
		tenantIds: ['public'],
		emails: ['mock@example.com'],
		phoneNumbers: [],
		thirdParty: [],
		webauthn: { credentialIds: [] },
		loginMethods: [
			{
				tenantIds: ['public'],
				timeJoined: now,
				recipeId: 'emailpassword',
				recipeUserId: 'mock-user',
				verified: true,
				email: 'mock@example.com',
			},
		],
	};

	SuperTokens.init({
		appInfo: {
			appName: APPNAME,
			websiteDomain: import.meta.env.VITE_APP_DOMAIN,
			apiDomain: import.meta.env.VITE_API_DOMAIN,
			apiBasePath: `/${routeConstants.API}/${routeConstants.AUTH}`,
			websiteBasePath: `/${routeConstants.AUTH}`,
		},
		recipeList: [
			EmailPassword.init({
				override: {
					functions: (original, builder) => ({
						...original,
						signIn: async (input) => {
							setMockLoggedIn(true);
							return { status: 'OK', user: mockUser, fetchResponse: dummyResponse };
						},
						signUp: async (input) => {
							setMockLoggedIn(true);
							return { status: 'OK', user: mockUser, fetchResponse: dummyResponse };
						},
						signOut: async () => {
							setMockLoggedIn(false);
							return { status: 'OK', fetchResponse: dummyResponse };
						},
						sendPasswordResetEmail: async () => ({ status: 'OK', fetchResponse: dummyResponse }),
						submitNewPassword: async () => ({ status: 'OK', fetchResponse: dummyResponse }),
					}),
				},
			}),
			Session.init({
				override: {
					functions: (original, builder) => ({
						...original,
						doesSessionExist: async () => getMockLoggedIn(),
						getUserId: async () => (getMockLoggedIn() ? 'mock-user' : ''),
						getAccessTokenPayloadSecurely: async () => (getMockLoggedIn() ? {} : undefined),
						signOut: async () => {
							setMockLoggedIn(false);
						},
						shouldDoInterceptionBasedOnUrl: () => false,
					}),
				},
			}),
		],
	});
} else {
	SuperTokens.init({
		appInfo: {
			appName: APPNAME,
			websiteDomain: import.meta.env.VITE_APP_DOMAIN,
			apiDomain: import.meta.env.VITE_API_DOMAIN,
			apiBasePath: `/${routeConstants.API}/${routeConstants.AUTH}`,
			websiteBasePath: `/${routeConstants.AUTH}`,
		},
		recipeList: [EmailPassword.init(), Session.init()],
	});
}

function ClientApp() {
	const clientSideEmotionCache = createEmotionCache();

	return (
		<BrowserRouter>
			<AppProviders emotionCache={clientSideEmotionCache}>
				<App />
			</AppProviders>
		</BrowserRouter>
	);
}

const container = document.getElementById('root');
if (!container) {
	throw new Error("Root element '#root' not found for hydration.");
}

ReactDOM.hydrateRoot(container, <ClientApp />);
console.log('React app hydrated on client.');
