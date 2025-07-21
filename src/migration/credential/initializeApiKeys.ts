// scripts/setup/initializeApiKeys.ts

import { credentialStore } from '#server/store/credentialStore.js';

async function initializeApiKeys() {
	const userId = process.argv[2] || 'default';

	try {
		await credentialStore.initializeDefaultApiKeys(userId);
		console.log(`✅ API keys initialized for user: ${userId}`);
	} catch (error) {
		console.error('❌ Failed to initialize API keys:', error);
		process.exit(1);
	}
}

initializeApiKeys();
