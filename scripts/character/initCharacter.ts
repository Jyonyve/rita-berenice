// Save this file as scripts/initCharacter.ts

import { ChromaClient } from 'chromadb';
// Assuming these imports are correct for your project structure
import { COLLECTIONS, METADATA_TYPES } from '../../src/shared/domain/chromadb/ChromaInterfaces.ts';
// Import the *updated* interface without image paths
import type { CharacterMetadata } from '../../src/shared/domain/character/CharacterInterfaces.ts'; // Adjust path if needed
import { buildCharacterId } from '../../src/shared/util/idUtils.ts';
import { tarionOriginal, tarionSpinoff } from './migrationTemplates.ts';

// --- Configuration ---
const CHROMA_URL = process.env.CHROMA_API_URL || 'https://chromadb-flyio.fly.dev'; // Use env var or default

// --- Main Seeding Logic (Simplified) ---
async function initCharacter() {
	console.log(`Connecting to ChromaDB at: ${CHROMA_URL}`);
	const chroma = new ChromaClient({ path: CHROMA_URL });

	const { characterId } = tarionOriginal;
	// const { characterId } = tarionSpinoff;
	// const { characterId } = mondayOriginal;

	try {
		// 1. Get or Create the CHARACTER Collection
		console.log(`Ensuring character collection "${COLLECTIONS.CHARACTER}" exists...`);
		const collection = await chroma.getOrCreateCollection({
			name: COLLECTIONS.CHARACTER,
			metadata: {
				description: 'Stores character definitions and metadata.',
				created_by_script: 'initCharacter.ts',
				type: COLLECTIONS.CHARACTER,
			},
			// embeddingFunction: yourEmbeddingFunction // Optional
		});
		console.log(`Collection "${COLLECTIONS.CHARACTER}" ready.`);

		// 2. Upsert Character Data Directly (Metadata DOES NOT include image paths)
		console.log(`Upserting character "${characterId}"...`);

		await collection.upsert({
			ids: [characterId],
			documents: [JSON.stringify(tarionOriginal)],
			metadatas: [tarionOriginal],
		});

		console.log(
			`Successfully seeded character "${characterId}" into collection "${COLLECTIONS.CHARACTER}".`
		);
	} catch (error) {
		console.error('Error seeding initial character data:', error);
		process.exit(1); // Exit with error code
	}
}

// --- Run the script ---
initCharacter();
