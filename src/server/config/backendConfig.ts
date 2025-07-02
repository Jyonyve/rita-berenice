import { appInfo } from '#shared/config/appInfo.js';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import Session from 'supertokens-node/recipe/session';

export const backendConfig = () => ({
	appInfo,
	recipeList: [EmailPassword.init(), Session.init()],
});
