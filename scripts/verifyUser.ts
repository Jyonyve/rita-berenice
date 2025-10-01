// scripts/verify-user.ts

import supertokens from 'supertokens-node';
import Emailpassword from 'supertokens-node/recipe/emailpassword';
import Session from 'supertokens-node/recipe/session';

// ... (your supertokens.init for production goes here, same as before)
supertokens.init({
	appInfo: {
		appName: 'Rita-Berenice',
		apiDomain: 'https://rita-berenice.fly.dev',
		websiteDomain: 'https://rita-berenice.fly.dev',
	},
	supertokens: {
		connectionURI: process.env.SUPERTOKENS_CONNECTION_URI!,
		apiKey: process.env.SUPERTOKENS_API_KEY,
	},
	recipeList: [Emailpassword.init(), Session.init()],
});

const emailToVerify = 'nthpopuptown@gmail.com';

async function runVerification() {
	console.log(`Verifying existence of user with email: ${emailToVerify}...`);
	try {
		// This is the CORRECT function to use.
		// The first argument is the tenantId, which defaults to "public".
		const response = await supertokens.listUsersByAccountInfo('public', { email: emailToVerify });
		// const response = await supertokens.getUser('754ab428-2e3f-4eaa-9c39-105053c9b78f');
		// const res = await supertokens.getUser('6b335673-c837-43f9-a1c7-0b92c90edefb');
		// console.log(response);
		// console.log(res);
		if (response.length > 0) {
			console.log('--- USER STILL EXISTS ---');
			console.log('SuperTokens still has a record of this user:');
			// The user object is nested inside the 'user' property of the response items
			response.forEach((userInfo) => console.log(userInfo));
		} else {
			console.log('--- USER DOES NOT EXIST ---');
			console.log('SuperTokens has no record of this user by email.');
		}
	} catch (error) {
		console.error('An error occurred during verification:', error);
	}
}

runVerification();
