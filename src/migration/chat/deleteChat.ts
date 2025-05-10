// Save this file as scripts/checkMondayChat.ts
import { ChromaClient, Collection, IncludeEnum } from 'chromadb';
import { ChatTurn, COLLECTIONS, METADATA_TYPES } from '../../shared/domain/index.ts';

// --- Configuration ---
const CHROMA_URL = process.env.CHROMA_API_URL || 'https://chromadb-flyio.fly.dev'; // Use env var or default
const TARGET_COLLECTION_NAME = COLLECTIONS.CHAT; // The collection where data was inserted
const TARGET_SESSION_ID = 'tarion_original_6b3557f0-225a-4b98-beae-28d428a83c50';
// const TARGET_SESSION_ID = 'monday_original_4addb91c-5733-4bf3-8142-a0ab98d0fd9e';
// const TARGET_SESSION_ID = 'tarion_spinoff_853b0fe0-cae6-4531-905d-3779262c73d4';

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
				// embeddingFunction: new DefaultEmbeddingFunction(), // getOrCreate might not require this if collection exists, but good practice
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
				// type: METADATA_TYPES.FULL_TURN
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
