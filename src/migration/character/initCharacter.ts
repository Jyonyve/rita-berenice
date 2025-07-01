// Save this file as scripts/initCharacter.ts

import { ChromaClient } from 'chromadb';
// REMOVED: No longer import DefaultEmbeddingFunction to avoid onnxruntime-node errors.
// import { DefaultEmbeddingFunction } from '@chroma-core/default-embed';

// Assuming these imports are correct for your project structure
import { mondayOriginal, tarionOriginal, tarionSpinoff } from './migrationTemplates.js';
import { COLLECTIONS } from '#server/db/ChromaInterfaces.js';

// --- Configuration ---
const CHROMA_HOST = 'chromadb-flyio.fly.dev';
const CHROMA_PORT = 443;
const CHROMA_SSL = true;

// --- Main Seeding Logic ---
async function initCharacter() {
	console.log(`Connecting to ChromaDB at: ${CHROMA_HOST}:${CHROMA_PORT}`);
	const chroma = new ChromaClient({ host: CHROMA_HOST, port: CHROMA_PORT, ssl: CHROMA_SSL });

	try {
		// Step 1: GET the collection. Do NOT create it. This is the core of the new logic.
		console.log(`Getting collection "${COLLECTIONS.CHARACTER}"...`);
		const collection = await chroma.getCollection({ name: COLLECTIONS.CHARACTER });
		console.log(`Collection "${COLLECTIONS.CHARACTER}" found and ready.`);

		// Step 2: It is now safe to upsert text data. The server will do the embedding.
		console.log(`Upserting characters...`);
		await collection.upsert({
			ids: [mondayOriginal.characterId, tarionOriginal.characterId, tarionSpinoff.characterId],
			documents: [
				JSON.stringify(mondayOriginal),
				JSON.stringify(tarionOriginal),
				JSON.stringify(tarionSpinoff),
			],
			metadatas: [
				mondayOriginal as Record<string, any>,
				tarionOriginal as Record<string, any>,
				tarionSpinoff as Record<string, any>,
			],
		});

		console.log(`✅ Successfully seeded characters.`);
		process.exit(0);
	} catch (error: any) {
		// Step 3: If getting the collection fails, exit with a helpful error.
		console.error('❌ Error seeding initial character data:', error.message);
		console.error(
			'This likely means the collection does not exist. Please run the admin creation script via SSH first.'
		);
		process.exit(1);
	}
}

// --- Run the script ---
initCharacter();
