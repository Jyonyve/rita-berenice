// scripts/checkProfile.ts

import { chromaDbClient } from '#server/db/chromaDbClient.js';
import { Where, IncludeEnum } from 'chromadb';

/**
 * Fetches and inspects a profile from the PROFILE collection in ChromaDB.
 * @param sessionId The ID of the session whose profile needs to be checked.
 */
async function checkProfile(sessionId: string) {
	try {
		console.log('Attempting to connect to ChromaDB and get PROFILE collection...');
		const profileCollection = await chromaDbClient.getProfileCollection();
		console.log('Successfully retrieved PROFILE collection.');

		const whereClause: Where = { sessionId: { $eq: sessionId } };
		console.log(`\nQuerying for profile with sessionId: "${sessionId}"`);

		const result = await profileCollection.get({
			where: whereClause,
			include: [IncludeEnum.metadatas, IncludeEnum.documents],
		});

		console.log('\n--- RAW DATABASE RESPONSE ---');

		if (!result || result.ids.length === 0) {
			console.log(`❌ No profile found matching the sessionId: "${sessionId}"`);
			process.exit(1);
		}

		console.log(`Found ${result.ids.length} record(s).`);
		for (let i = 0; i < result.ids.length; i++) {
			console.log(`\n--- Record ${i + 1} ---`);
			console.log(`ID:         `, result.ids[i]);
			console.log(`Metadata:   `, JSON.stringify(result.metadatas[i], null, 2));
			console.log(`Document:   `, result.documents[i]);
			console.log('--------------------');

			if (result.documents[i] === null || result.documents[i] === undefined) {
				console.error(
					`\n🚨 CRITICAL FINDING: The 'document' for this record is ${result.documents[i]}. This is the direct cause of the JSON.parse error.`
				);
			} else {
				console.log('✅ Document content appears to be present.');
			}
		}

		console.log('\nScript finished successfully.');
	} catch (error: any) {
		console.error('\n❌ An error occurred during the checkProfile script:');
		console.error(error.message);
		process.exit(1);
	}
}

// --- Script Execution ---
const sessionIdToCheck = process.argv[2];

if (!sessionIdToCheck) {
	console.error('🚨 Please provide a sessionId as a command-line argument.');
	console.error('Usage: tsx ./scripts/checkProfile.ts <sessionId>');
	process.exit(1);
}

checkProfile(sessionIdToCheck).catch((err) => {
	console.error('FATAL ERROR:', err);
	process.exit(1);
});
