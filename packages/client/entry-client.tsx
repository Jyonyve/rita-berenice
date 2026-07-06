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
