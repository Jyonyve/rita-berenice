// Save this file as scripts/initCharacter.ts

import { mondayOriginal, getTarionOriginal, getTarionSpinoff } from './migrationTemplates.js';
import { COLLECTIONS } from '#server/db/ChromaInterfaces.js';
import { characterStore } from '#server/index.js';

// --- Main Seeding Logic ---
async function initCharacter() {
	try {
		// Step 1: GET the collection. Do NOT create it. This is the core of the new logic.
		console.log(`Getting collection "${COLLECTIONS.CHARACTER}"...`);

		// Step 2: It is now safe to upsert text data. The server will do the embedding.
		console.log(`Upserting characters...`);
		console.log(await characterStore.storeCharacter(mondayOriginal));
		console.log(await characterStore.storeCharacter(getTarionOriginal('요니브')));
		console.log(await characterStore.storeCharacter(getTarionSpinoff('요니브')));

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
