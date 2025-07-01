// Save this file as scripts/checkCharacterData.ts

import { COLLECTIONS } from '#server/index.js';
import { CharacterMetadata } from '#shared/domain/index.js';
import { ChromaClient, Collection, IncludeEnum } from 'chromadb';

// --- Configuration ---
const CHROMA_HOST = process.env.CHROMA_HOST || 'chromadb-flyio.fly.dev';
const CHROMA_PORT = Number(process.env.CHROMA_PORT) || 443;
const CHROMA_SSL = true; // Your URL starts with https://

const COLLECTION_NAME = COLLECTIONS.CHARACTER; // The collection name for characters
// const TARGET_CHARACTER_ID = 'monday_original';
// const TARGET_CHARACTER_ID = 'tarion_original';
const TARGET_CHARACTER_ID = 'tarion_spinoff';

// --- Main Checking Logic ---
async function checkCharacterData() {
	console.log(`Connecting to ChromaDB at: ${CHROMA_HOST}:${CHROMA_PORT} (SSL: ${CHROMA_SSL})`);
	// 1. Use the new initialization with host, port, ssl, and an explicit embedding function.
	const chroma = new ChromaClient({ host: CHROMA_HOST, port: CHROMA_PORT, ssl: CHROMA_SSL });

	try {
		console.log(`Accessing collection "${COLLECTION_NAME}"...`);
		let collection: Collection;
		try {
			collection = await chroma.getCollection({ name: COLLECTION_NAME });
			console.log(`Collection "${COLLECTION_NAME}" accessed.`);
		} catch (error) {
			console.log(`Collection not found. Creating on server with its default embedder...`);
			// Create the collection WITHOUT specifying an embedding function.
			// The server will assign its own default.
			collection = await chroma.createCollection({ name: COLLECTION_NAME });
			console.log(`Collection "${COLLECTION_NAME}" created successfully.`);
		}

		// Query the collection by ID
		console.log(`Querying for document with ID: "${TARGET_CHARACTER_ID}"...`);
		// CORRECT: IncludeEnum values are now lowercase in v3
		const results = await collection.get({
			ids: [TARGET_CHARACTER_ID],
			include: [IncludeEnum.documents, IncludeEnum.metadatas],
		});

		// The rest of your checking logic remains the same...
		if (!results || results.ids.length === 0) {
			console.error(`\n--- CHECK FAILED ---`);
			console.error(`Error: Document with ID "${TARGET_CHARACTER_ID}" NOT FOUND...`);
		} else {
			console.log(`\n--- CHECK SUCCESSFUL (Data Found) ---`);
			const retrievedMetadata = results.metadatas?.[0] as CharacterMetadata | null | undefined;
			console.log('\n--- Retrieved Metadata ---');
			console.log(JSON.stringify(retrievedMetadata, null, 2));
			// ...and so on for your other checks.
		}
	} catch (error) {
		console.error('\n--- SCRIPT ERROR ---');
		console.error('An unexpected error occurred while checking data:', error);
		console.error('------------------\n');
		process.exit(1);
	}
}

// --- Run the script ---
checkCharacterData();
