// scripts/checkHistory.ts
import { ChromaClient, Collection, IncludeEnum, Where } from 'chromadb';
import { COLLECTIONS } from '../../server/db/ChromaInterfaces.js';
import { HistoryMetadata } from '../../shared/domain/lore/LoreInterfaces.js';
import { METADATA_TYPES } from '#shared/config/constants.js';

const CHROMA_URL = process.env.CHROMA_API_URL || 'https://chromadb-flyio.fly.dev';
const TARGET_COLLECTION_NAME = COLLECTIONS.LORE;

async function checkAllHistories() {
	console.log(`Connecting to ChromaDB at: ${CHROMA_URL}`);
	const chroma = new ChromaClient({ path: CHROMA_URL });

	try {
		console.log(`Accessing collection "${TARGET_COLLECTION_NAME}"...`);
		const collection: Collection = await chroma.getOrCreateCollection({
			name: TARGET_COLLECTION_NAME,
			metadata: { check_script_access: new Date().toISOString() },
		});
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
				console.log(`  ID: ${typed?.historyId}`);
				console.log(`  Title: ${typed?.title}`);
				console.log(`  Generated Title: ${typed?.generatedTitle}`);
				console.log(`  EnglishId: ${typed?.englishId}`);
				console.log(`  Owner Characters: ${typed?.ownerCharacterIds}`);
				console.log(`  Side Characters: ${typed?.sideCharacterIds}`);
				console.log(`  Period: ${typed?.periodLabel} (${typed?.periodConfidence})`);
				console.log(
					`  Event Date: ${typed?.eventDateValue} (${typed?.eventDateType}, ${typed?.eventDateConfidence})`
				);
				console.log(`  Category: ${typed?.category}`);
				console.log('---');
			});
			console.log(`Total history documents: ${results.ids.length}`);
		}
	} catch (error) {
		console.error('Error checking all histories:', error);
		process.exit(1);
	}
}

checkAllHistories();
