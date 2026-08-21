import './style/index.css';
import { APPNAME } from '@rita-berenice/shared/config';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import SuperTokens from 'supertokens-auth-react';
import EmailPassword from 'supertokens-auth-react/recipe/emailpassword/index.js';
import Session from 'supertokens-auth-react/recipe/session/index.js';
import { routeConstants } from './routeConstants.js';
import { API_KEY_SETUP_PARAM, API_KEY_SETUP_VALUE } from './page/user/apiKeyConfig.js';
import { superTokenUiStyle } from './style/superTokensUi.js';
import { createEmotionCache } from './util/index.js';
import { initializeApiClient } from './util/clientApiHelpers.js';
import { initializeTranslationLanguage } from './util/translateUtils.js';
import { AppProviders } from './AppProviders.js';
import { App } from './App.js';

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
	// SuperTokens defaults to `/` on success, which drops every authenticated user on the
	// landing page with nothing to do. Split the two cases instead:
	//   - a brand-new account has no provider API key yet and cannot chat until it has one,
	//     so send it straight to the API key section of the profile page;
	//   - a returning sign-in goes to the character list, the actual starting point.
	// The signup destination deliberately outranks `redirectToPath`: whatever protected page
	// sent the user to auth is still unusable without a key.
	getRedirectionURL: async (context) => {
		if (context.action !== 'SUCCESS') {
			return undefined;
		}
		if (context.createdNewUser) {
			return `/${routeConstants.USER}?${API_KEY_SETUP_PARAM}=${API_KEY_SETUP_VALUE}`;
		}

		return context.redirectToPath ?? `/${routeConstants.CHARACTER}`;
	},
	recipeList: [EmailPassword.init(), Session.init()],
});

// Install session-aware API handling before hydration can start authenticated queries.
initializeApiClient();

const initialLang = initializeTranslationLanguage(
	(window as Window & { __INITIAL_LANG__?: unknown }).__INITIAL_LANG__
);

function ClientApp() {
	const clientSideEmotionCache = createEmotionCache();
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
