// Save this file as scripts/checkMondayChat.ts
import { ChromaClient, Collection, IncludeEnum } from 'chromadb';
import { COLLECTIONS } from '#server/db/ChromaInterfaces.js';

// --- Configuration ---
const CHROMA_URL = process.env.CHROMA_API_URL || 'https://chromadb-flyio.fly.dev'; // Use env var or default
// const MONDAY_ORIGINAL_SESSIONID = 'monday_original_moH1Pu9n3BXz3OmY';
// const TARION_ORIGINAL_SESSIONID = 'tarion_original_QWE04yIbc8QN7NPw';
const TARION_SPINOFF_SESSIONID = 'tarion_spinoff_kEEKct7tfgmxDZQr';

const TARGET_COLLECTION_NAME = COLLECTIONS.CHAT; // The collection where data was inserted
// const TARGET_SESSION_ID = MONDAY_ORIGINAL_SESSIONID ?? '';
// const TARGET_SESSION_ID = TARION_ORIGINAL_SESSIONID ?? '';
const TARGET_SESSION_ID = TARION_SPINOFF_SESSIONID ?? '';

// --- Main Checking Logic ---
async function deleteSeededData() {
	console.log(`Connecting to ChromaDB at: ${CHROMA_URL}`);
	const chroma = new ChromaClient({ path: CHROMA_URL });

	try {
		// 1. Get the Collection (use getCollection, assumes it exists)
		console.log(`Accessing collection "${TARGET_COLLECTION_NAME}"...`);
		let collection: Collection;
		try {
			// Provide the embedding function to satisfy the type
			collection = await chroma.getOrCreateCollection({
				name: TARGET_COLLECTION_NAME,
				// Metadata here is less critical for checking, can be minimal or match seeding script
				metadata: { check_script_access: new Date().toISOString() },
			});
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

		// 2. Query the collection by Session ID metadata
		console.log(`Querying for documents with sessionId: "${TARGET_SESSION_ID}"...`);

		await collection.delete({
			where: {
				sessionId: TARGET_SESSION_ID,
				// type: METADATA_TYPES.TURN
			},
			// limit: 5 // Optional limit
		});

		// 3. Display Results
	} catch (error) {
		console.error('Error checking seeded data:', error);
		process.exit(1);
	}
}

// --- Run the script ---
deleteSeededData();
