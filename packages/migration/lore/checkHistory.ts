// scripts/checkHistory.ts

import { COLLECTIONS } from '@rita-berenice/server/db';
import { loreStore } from '@rita-berenice/server/store';
import { Collection } from 'chromadb';

// const CHROMA_URL = process.env.CHROMA_HOST;
const TARGET_COLLECTION_NAME = COLLECTIONS.LORE;

async function checkAllHistories() {
	// console.log(`Connecting to ChromaDB at: ${CHROMA_URL}`);
	try {
		console.log(`Accessing collection "${TARGET_COLLECTION_NAME}"...`);
		const collection: Collection = await loreStore._getCollection();
		console.log(`Collection "${TARGET_COLLECTION_NAME}" accessed.`);

		console.log(`Querying for ALL history documents (type: HISTORY)...`);
		const result = await collection.get();
		// const result = await collection.get({ where: { characterId: { $eq: characterId } } });
		// await collection.delete({ ids: result.ids });
		console.log(result.metadatas);
	} catch (error) {
		console.error('Error checking all histories:', error);
		process.exit(1);
	}
}
const characterId = process.argv[2];
checkAllHistories();
