// src/client/entry-client.tsx
import { App } from '#client/App.jsx';
import { AppProviders } from '#client/AppProviders.jsx';
import { mockAuthStore } from '#client/mock/mockAuthStore.js';
import { routeConstants } from '#client/routeConstants.js';
import '#client/style/index.css';
import { superTokenUiStyle } from '#client/style/superTokensUi.js';
import { APPNAME } from '#shared/config/constants.js';
import { createEmotionCache } from '#shared/config/createEmotionCache.js';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import SuperTokens from 'supertokens-auth-react';
import EmailPassword from 'supertokens-auth-react/recipe/emailpassword/index.js';
import Session from 'supertokens-auth-react/recipe/session/index.js';
import { User } from 'supertokens-web-js/types/index.js';

// Fixed timestamp value to avoid SSR/client hydration errors
const FIXED_TIME_JOINED = 1752625706636;
const dummyResponse = new Response(null, { status: 200 });
const mockUser: User = {
	id: 'mock-user',
	timeJoined: FIXED_TIME_JOINED,
	isPrimaryUser: false,
	tenantIds: ['public'],
	emails: ['mock@example.com'],
	phoneNumbers: [],
	thirdParty: [],
	webauthn: { credentialIds: [] },
	loginMethods: [
		{
			tenantIds: ['public'],
			timeJoined: FIXED_TIME_JOINED,
			recipeId: 'emailpassword',
			recipeUserId: 'mock-user',
			verified: true,
			email: 'mock@example.com',
		},
	],
};

const isStatic = import.meta.env.VITE_APP_MODE === 'static';

if (isStatic) {
	SuperTokens.init({
		appInfo: {
			appName: APPNAME,
			websiteDomain: import.meta.env.VITE_APP_DOMAIN,
			apiDomain: import.meta.env.VITE_API_DOMAIN,
			apiBasePath: `/${routeConstants.AUTH}`,
		},
		style: superTokenUiStyle,
		getRedirectionURL: async (context) => {
			// return undefined to let the default behaviour play out
			return null;
		},
		recipeList: [
			EmailPassword.init({
				getRedirectionURL: async (context) => {
					return null;
				},
				override: {
					functions: (original) => ({
						...original,
						signIn: async (input) => {
							console.log('Mock signIn called');
							mockAuthStore.setLoggedIn(true);
							return { status: 'OK', user: mockUser, fetchResponse: dummyResponse };
						},
						signUp: async (input) => {
							console.log('Mock signUp called');
							mockAuthStore.setLoggedIn(true);
							return { status: 'OK', user: mockUser, fetchResponse: dummyResponse };
						},
						signOut: async () => {
							await Session.signOut();
							return { status: 'OK', fetchResponse: dummyResponse };
						},
						sendPasswordResetEmail: async () => ({ status: 'OK', fetchResponse: dummyResponse }),
						submitNewPassword: async () => ({ status: 'OK', fetchResponse: dummyResponse }),
					}),
				},
			}),
			Session.init({
				override: {
					functions: (original) => ({
						...original,
						doesSessionExist: async () => {
							const isLoggedIn = mockAuthStore.getSnapshot();
							console.log('[SuperTokens Mock] doesSessionExist called, returning:', isLoggedIn);
							return isLoggedIn;
						},
						getUserId: async () => (mockAuthStore.getSnapshot() ? 'mock-user' : ''),
						getAccessTokenPayloadSecurely: async () => (mockAuthStore.getSnapshot() ? {} : undefined),
						signOut: async () => {
							console.log('[SuperTokens Mock] Session.signOut called');
							mockAuthStore.setLoggedIn(false);
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
		style: superTokenUiStyle,
		recipeList: [EmailPassword.init(), Session.init()],
	});
}

function ClientApp() {
	const clientSideEmotionCache = createEmotionCache();

	return (
		<BrowserRouter basename={import.meta.env.BASE_URL}>
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
