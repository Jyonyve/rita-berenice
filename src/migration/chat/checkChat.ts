import { COLLECTIONS } from '#server/db/ChromaInterfaces.js';
import { chatStore } from '#server/index.js';

// --- Configuration ---

const TARGET_COLLECTION_NAME = COLLECTIONS.CHAT; // The collection where data was inserted
// const TARGET_SESSION_ID = MONDAY_ORIGINAL_SESSIONID ?? '';
const TARGET_SESSION_ID = 'tarion_spinoff_sw1MLtIj';
// const TARGET_SESSION_ID = 'tarion_spinoff_Oin8t5Lxbc8glaU7';

// --- Main Checking Logic ---
async function checkSeededData() {
	try {
		// 1. Get the Collection (use getCollection, assumes it exists)
		console.log(`Accessing collection "${TARGET_COLLECTION_NAME}"...`);

		try {
			const result = await chatStore.getAllChatTurns(TARGET_SESSION_ID);
			console.log(result.chatTurns.length);
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
