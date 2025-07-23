import { COLLECTIONS } from '#server/db/ChromaInterfaces.js';
import { chatStore, chromaDbClient, tempStore } from '#server/index.js';

// --- Configuration ---
const TARGET_COLLECTION_NAME = COLLECTIONS.TEMP;

/**
 * Checks the database for chat turns associated with a specific session ID.
 * @param sessionId The ID of the session to check.
 */
async function checkSeededData(sessionId: string) {
	try {
		console.log(`Accessing collection "${TARGET_COLLECTION_NAME}" for session ID: ${sessionId}...`);
		const collection = chromaDbClient.getTempChatCollection();
		const result = await (await collection).get({});
		console.log(`✅ Found ${result.ids.length} chat turns for the session.`);
		console.log(result);
	} catch (error) {
		// Handle cases where the collection or data might not exist
		if (error instanceof Error && error.message.includes('does not exist')) {
			console.error(
				`Error: Collection "${TARGET_COLLECTION_NAME}" does not exist. Ensure the seeding script ran successfully.`
			);
		} else {
			console.error(`Error accessing data for session "${sessionId}":`, error);
		}
		process.exit(1);
	}
}

// --- Script Execution ---
const sessionId = process.argv[2];

if (!sessionId) {
	console.error('🚨 Please provide a sessionId as a command-line argument.');
	console.error('Usage: tsx ./path/to/your/script.ts <sessionId>');
	process.exit(1);
}

checkSeededData(sessionId).catch((err) => {
	console.error('FATAL ERROR:', err);
	process.exit(1);
});
