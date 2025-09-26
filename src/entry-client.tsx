// src/client/entry-client.tsx
import { App } from '#client/App.jsx';
import { AppProviders } from '#client/AppProviders.jsx';
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
import type { APIFormField, UserContext } from 'supertokens-auth-react/lib/build/types.js';
import type { RecipeFunctionOptions } from 'supertokens-web-js/recipe/emailpassword/index.js';
import { cryptoState } from '#client/cryptoState.js';
import { UserCdo } from '#shared/domain/user/user.type.js';

type SignInInput = {
	formFields: APIFormField[];
	shouldTryLinkingWithSessionUser: boolean | undefined;
	options?: RecipeFunctionOptions;
	userContext: UserContext;
};

SuperTokens.init({
	appInfo: {
		appName: APPNAME,
		websiteDomain: import.meta.env.VITE_APP_DOMAIN,
		apiDomain: import.meta.env.VITE_API_DOMAIN,
		apiBasePath: `/${routeConstants.API}/${routeConstants.AUTH}`,
		websiteBasePath: `/${routeConstants.AUTH}`,
	},
	style: superTokenUiStyle,
	enableDebugLogs: false,
	recipeList: [
		EmailPassword.init({
			override: {
				functions: (originalImplementation) => ({
					...originalImplementation,
					signIn: async function (input: SignInInput) {
						const publicKey = cryptoState.publicKey;

						if (!publicKey) {
							return {
								status: 'GENERAL_ERROR',
								message: 'Security key not loaded. Please wait and try again.',
							};
						}

						const email = input.formFields.find((f) => f.id === 'email')?.value;
						const password = input.formFields.find((f) => f.id === 'password')?.value;

						if (!email || !password) {
							return originalImplementation.signIn(input);
						}

						try {
							const credentials = JSON.stringify({ email, password });
							const encodedCredentials = new TextEncoder().encode(credentials);
							const encryptedBuffer = await window.crypto.subtle.encrypt(
								{ name: 'RSA-OAEP' },
								publicKey,
								encodedCredentials
							);
							const encryptedData = btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer)));

							// --- THE FINAL FIX ---
							// Update the URL to match your new, non-conflicting API route.
							const response = await fetch('/api/login/login-asymmetric', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({ encryptedData }),
							});

							return response.json();
						} catch (error) {
							console.error('Encryption or fetch failed', error);
							return { status: 'GENERAL_ERROR', message: 'An unexpected error occurred.' };
						}
					},
				}),
			},
		}),
		Session.init(),
	],
});

const getServerDetectedLang = () => {
	if (typeof window !== 'undefined' && (window as any).__INITIAL_LANG__) {
		return (window as any).__INITIAL_LANG__;
	}
	return 'eng';
};

function ClientApp() {
	const clientSideEmotionCache = createEmotionCache();
	const initialLang = getServerDetectedLang();
	return (
		<BrowserRouter basename={import.meta.env.BASE_URL}>
			<AppProviders emotionCache={clientSideEmotionCache} initialLang={initialLang}>
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
