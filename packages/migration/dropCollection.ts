// Save this file as scripts/dropChatCollection.ts
import { ChromaClient } from 'chromadb';
import { COLLECTIONS } from '#server/db/ChromaInterfaces.js';
import { chromaDbClient } from '../server/index.ts';
// --- Configuration ---

const COLLECTION_TO_DROP = COLLECTIONS.CREDENTIAL;

// Destination DB: Your new Fly.io Chroma instance
// const DESTINATION_CONFIG = { host: 'rita-berenice-chromadb.fly.dev', port: 443, ssl: true };
const DESTINATION_CONFIG = { host: 'localhost', port: 8000 };
// --- Configuration ---
// --- Main Deletion Logic ---
async function dropCollection() {
	const chromaClient = new ChromaClient({ ...DESTINATION_CONFIG });
	const list = await chromaClient.listCollections();
	console.log(list);
	try {
		console.log(`Attempting to delete collection "${COLLECTION_TO_DROP}"...`);
		const collection = await chromaClient.getCollection({ name: COLLECTION_TO_DROP });
		console.log(collection);

		// const allIds = (await collection.get()).ids;
		// if (allIds && allIds.length > 0) {
		// 	await collection.delete({ ids: allIds });
		// }

		await chromaClient.deleteCollection({ name: COLLECTION_TO_DROP });

		console.log(`Successfully deleted collection Data "${COLLECTION_TO_DROP}".`);
		console.log(
			'The collection will be recreated automatically by your application or the seeding script when next needed.'
		);
	} catch (error) {
		// Handle cases where the collection might already not exist
		if (
			error instanceof Error &&
			(error.message.includes('does not exist') || error.message.toLowerCase().includes('not found'))
		) {
			console.log(
				`Collection "${COLLECTION_TO_DROP}" does not exist or was already deleted. Nothing to do.`
			);
			// Consider exiting gracefully if it's expected it might not exist
			process.exit(0);
		} else {
			// Log other unexpected errors
			console.error(`Error deleting collection "${COLLECTION_TO_DROP}":`, error);
			process.exit(1); // Exit with an error code for unexpected failures
		}
	}
}

// --- Run the script ---
console.warn(
	`🚨 WARNING: About to delete the ENTIRE "${COLLECTION_TO_DROP}" collection . This is irreversible.`
);
console.warn('Press Ctrl+C within 5 seconds to cancel, or wait to proceed...');

// Simple delay to allow cancellation
setTimeout(() => {
	console.log('Proceeding with deletion...');
	dropCollection();
}, 5000); // 5-second delay
