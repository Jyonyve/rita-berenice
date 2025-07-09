// scripts/checkProfile.ts

import { chromaDbClient } from '#server/db/chromaDbClient.js';
import { Where, IncludeEnum } from 'chromadb';

// --- Configuration ---
// The sessionId from your init script and the failing API call.
const sessionIdToCheck = 'tarion_spinoff_Oin8t5Lxbc8glaU7';
// ---

async function checkProfile() {
	try {
		console.log('Attempting to connect to ChromaDB and get PROFILE collection...');
		const profileCollection = await chromaDbClient.getProfileCollection();
		console.log('Successfully retrieved PROFILE collection.');

		// Define the query to find the specific profile by its sessionId metadata
		const whereClause: Where = { sessionId: { $eq: sessionIdToCheck } };

		console.log(`\nQuerying for profile with sessionId: "${sessionIdToCheck}"`);

		// Perform a raw 'get' operation on the collection
		const result = await profileCollection.get({
			where: whereClause,
			include: [IncludeEnum.metadatas, IncludeEnum.documents], // Explicitly include documents
		});

		console.log('\n--- RAW DATABASE RESPONSE ---');

		if (!result || result.ids.length === 0) {
			console.log('❌ No profile found matching the specified sessionId.');
			process.exit(1);
		}

		// Log the results in a readable format
		console.log(`Found ${result.ids.length} record(s).`);
		for (let i = 0; i < result.ids.length; i++) {
			console.log(`\n--- Record ${i + 1} ---`);
			console.log(`ID:         `, result.ids[i]);
			console.log(`Metadata:   `, JSON.stringify(result.metadatas[i], null, 2));
			console.log(`Document:   `, result.documents[i]);
			console.log('--------------------');

			// Specifically check if the document content is null or undefined
			if (result.documents[i] === null || result.documents[i] === undefined) {
				console.error(
					`\n🚨 CRITICAL FINDING: The 'document' for this record is ${result.documents[i]}. This is the direct cause of the JSON.parse error.`
				);
			} else {
				console.log('✅ Document content appears to be present.');
			}
		}

		console.log('\nScript finished successfully.');
		process.exit(0);
	} catch (error: any) {
		console.error('\n❌ An error occurred during the checkProfile script:');
		console.error(error.message);
		process.exit(1);
	}
}

// --- Run the script ---
checkProfile();
