import { appInfo } from '#shared/config/appInfo.js';
import EmailPassword from 'supertokens-auth-react/recipe/emailpassword/index.js';
import Session from 'supertokens-auth-react/recipe/session/index.js';

export const frontendConfig = () => ({
	appInfo,
	recipeList: [EmailPassword.init(), Session.default.init()],
});
