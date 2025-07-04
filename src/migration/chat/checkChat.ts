// Save this file as scripts/checkMondayChat.ts
import { ChromaClient, Collection, IncludeEnum, Where } from 'chromadb';
import { COLLECTIONS } from '#server/db/ChromaInterfaces.js';
import { METADATA_TYPES } from '#shared/config/constants.js';
import { chatStore } from '#server/index.js';

// --- Configuration ---
const TARION_SPINOFF_SESSIONID = 'tarion_spinoff_XGYh7KMZdRRodrJF';

const TARGET_COLLECTION_NAME = COLLECTIONS.CHAT; // The collection where data was inserted
// const TARGET_SESSION_ID = MONDAY_ORIGINAL_SESSIONID ?? '';
// const TARGET_SESSION_ID = TARION_ORIGINAL_SESSIONID ?? '';
const TARGET_SESSION_ID = TARION_SPINOFF_SESSIONID ?? '';

// --- Main Checking Logic ---
async function checkSeededData() {
	try {
		// 1. Get the Collection (use getCollection, assumes it exists)
		console.log(`Accessing collection "${TARGET_COLLECTION_NAME}"...`);

		try {
			console.log(await chatStore.getChatTurns('tarion_spinoff_XGYh7KMZdRRodrJF', 6));
			console.log(`Collection "${TARGET_COLLECTION_NAME}" accessed.`);
		} catch (error) {
			// Handle cases where the collection might *actually* not exist
			if (error instanceof Error && error.message.includes('does not exist')) {
				console.error(
					`Error: Collection "${TARGET_COLLECTION_NAME}" does not exist. Ensure the seeding script ran successfully.`
				);
			} else {
				console.error(`Error accessing collection "${TARGET_COLLECTION_NAME}":`, error);
			}
			process.exit(1);
		}
	} catch (error) {
		console.error('Error checking seeded data:', error);
		process.exit(1);
	}
}

// --- Run the script ---
checkSeededData();
