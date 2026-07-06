// scripts/create-user-with-legacy-id.ts

import supertokens from 'supertokens-node';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import Session from 'supertokens-node/recipe/session';

// Initialize SuperTokens to connect to your PRODUCTION instance
supertokens.init({
	appInfo: {
		appName: 'Rita-Berenice-Admin-Task',
		apiDomain: 'https://rita-berenice.fly.dev',
		websiteDomain: 'https://rita-berenice.fly.dev',
	},
	supertokens: {
		connectionURI: process.env.SUPERTOKENS_CONNECTION_URI!,
		apiKey: process.env.SUPERTOKENS_API_KEY,
	},
	recipeList: [
		EmailPassword.init({
			// You may need to provide your override functions here if you have any
		}),
		Session.init(),
	],
});

// --- Configuration ---
const userToCreate = {
	// This is the correct, original userId from your local environment
	userId: '6b335673-c837-43f9-a1c7-0b92c90edefb',
	email: 'nthpopuptown@gmail.com',
	// You must provide the password you want to use for this user
	password: 'jcpenguin4*',
};

async function runCreation() {
	console.log(
		`Attempting to create user for ${userToCreate.email} with legacy ID ${userToCreate.userId}...`
	);
	try {
		const response = await EmailPassword.signUp(
			userToCreate.email,
			userToCreate.password,
			userToCreate.userId // <-- This is the key parameter
		);

		if (response.status === 'OK') {
			console.log('--- SUCCESS ---');
			console.log('User created successfully in production with the correct legacy ID.');
			console.log(response.user);
		} else {
			// This will catch cases where the email or user ID already exists
			console.log('--- FAILED ---');
			console.log('Could not create the user. Status:', response.status);
		}
	} catch (error) {
		console.error('An error occurred during user creation:', error);
	}
}

runCreation();
