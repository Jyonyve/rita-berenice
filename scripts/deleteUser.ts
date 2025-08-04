// scripts/delete-prod-user.ts

import supertokens from 'supertokens-node';
import { deleteUser } from 'supertokens-node';
import Session, { revokeAllSessionsForUser } from 'supertokens-node/recipe/session';
import EmailPassword from 'supertokens-node/recipe/emailpassword';

// IMPORTANT: Configure this script to connect to your PRODUCTION SuperTokens instance.
// It's best to use environment variables for this.
supertokens.init({
	appInfo: {
		appName: 'Rita-Berenice-Migration', // Use a distinct appName for admin tasks
		apiDomain: 'https://rita-berenice.fly.dev',
		websiteDomain: 'https://rita-berenice.fly.dev',
		apiBasePath: `/api/auth`,
		websiteBasePath: `/auth`,
	},
	supertokens: {
		// This must be the connection URI for your production SuperTokens core
		connectionURI: process.env.SUPERTOKENS_CONNECTION_URI!,
		apiKey: process.env.SUPERTOKENS_API_KEY,
	},
	recipeList: [EmailPassword.init(), Session.init()],
});

// The User ID of the INCORRECT user you created in production.
const userIdToDelete = '754ab428-2e3f-4eaa-9c39-105053c9b78f';

async function runRevocation(userId: string) {
	console.log(`Forcefully revoking all sessions for user ID: ${userId}...`);
	try {
		await revokeAllSessionsForUser(userId);
		console.log(`Successfully revoked all sessions for user: ${userId}.`);
	} catch (error) {
		console.error('An error occurred during session revocation:', error);
	}
}

async function runDeletion() {
	await runRevocation(userIdToDelete);

	console.log(`Attempting to delete user with ID: ${userIdToDelete}...`);
	try {
		const response = await deleteUser(userIdToDelete, true);
		console.log(response);
		// The deleteUser function resolves successfully even if the user didn't exist [140].
		console.log(`Successfully processed deletion for user ID: ${userIdToDelete}.`);
		console.log('You can now proceed with your user migration.');
	} catch (error) {
		console.error('An error occurred during user deletion:');
		console.error(error);
	}
}

runDeletion();
