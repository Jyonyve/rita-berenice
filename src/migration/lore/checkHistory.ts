// scripts/checkHistory.ts
import { ChromaClient, Collection, IncludeEnum, Where } from 'chromadb';
import { COLLECTIONS } from '../../server/db/ChromaInterfaces.js';
import { HistoryMetadata } from '../../shared/domain/lore/LoreInterfaces.js';
import { METADATA_TYPES } from '#shared/config/constants.js';
import { loreStore } from '#server/index.js';

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
		await collection.delete({ ids: result.ids });
		console.log(result);
	} catch (error) {
		console.error('Error checking all histories:', error);
		process.exit(1);
	}
}
const characterId = process.argv[2];
checkAllHistories();
