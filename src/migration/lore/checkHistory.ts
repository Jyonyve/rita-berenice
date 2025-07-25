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
		const whereClause: Where = { type: { $eq: METADATA_TYPES.HISTORY } };

		const results = await collection.get({
			where: whereClause,
			include: [IncludeEnum.documents, IncludeEnum.metadatas],
		});

		if (!results || results.ids.length === 0) {
			console.log(`No history documents found in collection "${TARGET_COLLECTION_NAME}".`);
		} else {
			console.log(`Found ${results.ids.length} history documents:`);
			console.log('---');
			results.metadatas.forEach((metadata, index) => {
				const typed = metadata;
				console.log(`History ${index + 1}:`);
				console.log(`  historyId: ${typed?.historyId}`);
				console.log(`  title: ${typed?.title}`);
				console.log(`  generatedTitle: ${typed?.generatedTitle}`);
				console.log(`  englishId: ${typed?.englishId}`);
				console.log(`  ownerCharacterIds: ${typed?.ownerCharacterIds}`);
				console.log(`  sideCharacterIds: ${typed?.sideCharacterIds}`);
				console.log(
					`  periodLabel: ${typed?.periodLabel} periodConfidence :(${typed?.periodConfidence})`
				);
				console.log(
					`  eventDateValue: ${typed?.eventDateValue} eventDateType: (${typed?.eventDateType}, eventDateConfidence: ${typed?.eventDateConfidence})`
				);
				console.log(`  category: ${typed?.category}`);
				console.log('---');
			});
			console.log(`Total history entities: ${results.ids.length}`);
		}
	} catch (error) {
		console.error('Error checking all histories:', error);
		process.exit(1);
	}
}

checkAllHistories();
