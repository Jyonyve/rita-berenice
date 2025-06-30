// Save this file as scripts/checkMondayChat.ts
import { ChromaClient, Collection, IncludeEnum, Where } from 'chromadb';
import { COLLECTIONS, METADATA_TYPES } from '#shared/domain/index.js';

// --- Configuration ---
const CHROMA_URL = process.env.CHROMA_API_URL || 'https://chromadb-flyio.fly.dev'; // Use env var or default
// const MONDAY_ORIGINAL_SESSIONID = 'monday_original_moH1Pu9n3BXz3OmY';
// const TARION_ORIGINAL_SESSIONID = 'tarion_original_QWE04yIbc8QN7NPw';
const TARION_SPINOFF_SESSIONID = 'tarion_spinoff_0RWsIE7zKLQ3ANEN';

const TARGET_COLLECTION_NAME = COLLECTIONS.CHAT; // The collection where data was inserted
// const TARGET_SESSION_ID = MONDAY_ORIGINAL_SESSIONID ?? '';
// const TARGET_SESSION_ID = TARION_ORIGINAL_SESSIONID ?? '';
const TARGET_SESSION_ID = TARION_SPINOFF_SESSIONID ?? '';

// --- Main Checking Logic ---
async function checkSeededData() {
	console.log(`Connecting to ChromaDB at: ${CHROMA_URL}`);
	const chroma = new ChromaClient({ path: CHROMA_URL });

	try {
		// 1. Get the Collection (use getCollection, assumes it exists)
		console.log(`Accessing collection "${TARGET_COLLECTION_NAME}"...`);
		let collection: Collection;
		try {
			// Provide the embedding function to satisfy the type
			collection = await chroma.getOrCreateCollection({
				name: TARGET_COLLECTION_NAME,
				// Metadata here is less critical for checking, can be minimal or match seeding script
				metadata: { check_script_access: new Date().toISOString() },
				// embeddingFunction: new DefaultEmbeddingFunction(), // getOrCreate might not require this if collection exists, but good practice
			});
			console.log(`Collection "${TARGET_COLLECTION_NAME}" accessed.`);
		} catch (error) {
			// Handle cases where the collection might *actually* not exist
			if (error instanceof Error && error.message.includes('does not exist')) {
				console.error(
					`Error: Collection "${TARGET_COLLECTION_NAME}" does not exist. Ensure the seeding script ran successfully.`
				);
			} else {
				console.error(`Error accessing collection "${TARGET_COLLECTION_NAME}":`, error);
			}
			process.exit(1);
		}

		// 2. Query the collection by Session ID metadata
		console.log(`Querying for documents with sessionId: "${TARGET_SESSION_ID}"...`);
		const whereClause: Where = {
			$and: [
				{ sessionId: { $eq: 'tarion_spinoff_0RWsIE7zKLQ3ANEN' } },
				// { sessionId: { $in: ['tarion_spinoff_0RWsIE7zKLQ3ANEN', 'tarion_original_QWE04yIbc8QN7NPw'] } },
				{ type: { $eq: METADATA_TYPES.TURN } },
			],
		};
		const results = await collection.get({
			// ids: [
			// 	'tarion_original_QWE04yIbc8QN7NPw_76_turn',
			// 	'tarion_original_QWE04yIbc8QN7NPw_77_turn',
			// 	'tarion_original_QWE04yIbc8QN7NPw_201_turn',
			// 	'tarion_spinoff_0RWsIE7zKLQ3ANEN_419_turn',
			// 	'tarion_spinoff_0RWsIE7zKLQ3ANEN_629_turn',
			// 	'tarion_spinoff_0RWsIE7zKLQ3ANEN_781_turn',
			// 	'tarion_spinoff_0RWsIE7zKLQ3ANEN_817_turn',
			// 	'tarion_spinoff_0RWsIE7zKLQ3ANEN_987_turn',
			// 	'tarion_spinoff_0RWsIE7zKLQ3ANEN_1041_turn',
			// ], // Empty array to get all documents
			where: whereClause,
			include: [IncludeEnum.Documents, IncludeEnum.Metadatas],
			// limit: 5 // Optional limit
		});

		// 3. Display Results
		if (!results || results.ids.length === 0) {
			console.log(
				`No documents found in collection "${TARGET_COLLECTION_NAME}" matching sessionId "${TARGET_SESSION_ID}".`
			);
		} else {
			console.log(`Found ${results.ids.length} documents for sessionId "${TARGET_SESSION_ID}":`);
			console.log('---');
			results.metadatas.slice(0, 3).forEach((metadata, index) => {
				console.log(`Metadata for Document ${index + 1}:`);
				console.log(JSON.stringify(metadata, null, 2));
				console.log('---');
			});
			if (results.ids.length > 3) {
				console.log(`(... and ${results.ids.length - 3} more documents)`);
				console.log('---');
			}
			// results.ids.forEach((id, index) => {
			// 	const metadata = results.metadatas[index];
			// 	const document = results.documents[index];
			// 	const request = JSON.parse(document!).request as ChatMessage;
			// 	const response = JSON.parse(document!).response as ChatMessage;

			// 	console.log(`Document ${index + 1}:`);
			// 	console.log(`ID: ${id}`);
			// 	console.log(`${JSON.stringify(metadata, null, 2)}`);
			// 	console.log(`${parseEntriesToText(request.entries)}`);
			// 	console.log(`${parseEntriesToText(response.entries)}`);
			// 	console.log('---');
			// });
			// console.log(`Total documents confirmed for session ${TARGET_SESSION_ID}: ${results.ids.length}`);
		}
	} catch (error) {
		console.error('Error checking seeded data:', error);
		process.exit(1);
	}
}

// --- Run the script ---
checkSeededData();
