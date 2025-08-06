// src/migration/checkCollection.ts

import { OpenAIEmbeddingFunction } from '@chroma-core/openai';
import { ChromaClient, Collection } from 'chromadb';

// --- Configuration ---
const CHROMA_HOST = process.env.CHROMA_HOST;
const CHROMA_PORT = 443;
const CHROMA_SSL = true;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TARGET_COLLECTION_NAME = process.argv[2];

/**
 * Checks the database for records in a specific collection.
 */
async function checkCollection() {
	// 1. Define the embedding function for this script's context.
	const embedder = new OpenAIEmbeddingFunction({
		apiKey: OPENAI_API_KEY!,
		modelName: 'text-embedding-3-small', // Must match the model used to create the collection
	});

	try {
		// 2. Create a new, dedicated client instance for this script.
		const chromaClient = new ChromaClient({ host: CHROMA_HOST, port: CHROMA_PORT, ssl: CHROMA_SSL });

		console.log(`Accessing collection "${TARGET_COLLECTION_NAME}" ...`);

		// 3. Get the collection and explicitly provide the embedding function.
		// This ensures the client knows how to interact with the collection's vectors.
		const collection: Collection = await chromaClient.getCollection({
			name: TARGET_COLLECTION_NAME,
			embeddingFunction: embedder,
		});

		// 4. Perform the operation. This will now succeed.
		const result = await collection.get({});
		console.log(`✅ Found ${result.ids.length} records in "${TARGET_COLLECTION_NAME}".`);
	} catch (error) {
		if (error instanceof Error && error.message.toLowerCase().includes('does not exist')) {
			console.error(`❌ Error: Collection "${TARGET_COLLECTION_NAME}" does not exist.`);
		} else {
			// This will catch the 500 error and provide more context.
			console.error(`❌ Error accessing data for collection "${TARGET_COLLECTION_NAME}":`, error);
		}
		process.exit(1);
	}
}

// --- Script Execution ---

// Validate command-line arguments and environment variables first
if (!TARGET_COLLECTION_NAME) {
	console.error('🚨 Please provide a collection name as a command-line argument.');
	console.error('   Usage: pnpm collection <collectionName>');
	process.exit(1);
}

if (!OPENAI_API_KEY) {
	console.error('🚨 FATAL: OPENAI_API_KEY is not defined in your .env file.');
	process.exit(1);
}

// Run the main logic
checkCollection().catch((err) => {
	console.error('A fatal, unexpected error occurred:', err);
	process.exit(1);
});
