import './style/index.css';
import { APPNAME } from '@rita-berenice/shared/config';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import SuperTokens from 'supertokens-auth-react';
import EmailPassword from 'supertokens-auth-react/recipe/emailpassword/index.js';
import Session from 'supertokens-auth-react/recipe/session/index.js';
import { routeConstants } from './routeConstants.js';
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
