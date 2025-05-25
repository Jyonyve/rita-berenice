// Save this file as scripts/checkMondayChat.ts
import { ChromaClient, Collection, IncludeEnum } from 'chromadb';
import { ChatTurn, COLLECTIONS } from '../../shared/domain/index.ts';

// --- Configuration ---
const CHROMA_URL = process.env.CHROMA_API_URL || 'https://chromadb-flyio.fly.dev'; // Use env var or default
// const MONDAY_ORIGINAL_SESSIONID = 'monday_original_P463ffCAGha67NMD';
// const TARION_ORIGINAL_SESSIONID = 'tarion_original_mPNZ6eQgtZOgwKuS';
const TARION_SPINOFF_SESSIONID = 'tarion_spinoff_OzyYixMFlJ3JpPuT';

const TARGET_COLLECTION_NAME = COLLECTIONS.CHAT; // The collection where data was inserted
// const TARGET_SESSION_ID = MONDAY_ORIGINAL_SESSIONID ?? '';
// const TARGET_SESSION_ID = TARION_ORIGINAL_SESSIONID ??'';
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

		const results = await collection.get({
			where: {
				sessionId: TARGET_SESSION_ID,
				// type: METADATA_TYPES.FULL_TURN
			},
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

			for (let i = 0; i < Math.min(results.ids.length, 3); i++) {
				console.log(`Document ID: ${results.ids[i]}`);
				console.log(`Metadata: ${JSON.stringify(results.metadatas?.[i])}`); // Safely access metadata
				try {
					// Safely access documents and parse
					const docString = results.documents?.[i];
					if (docString) {
						const chatTurnData: ChatTurn = JSON.parse(docString);
						console.log(`Content (Sequence ${chatTurnData.sequence}):`);
						console.log(
							`  Request Prompt: ${chatTurnData.request?.entries?.[0]?.type}\n"${chatTurnData.request?.entries?.[0]?.prompt?.substring(0, 80)}..."`
						);
						console.log(
							`  Response Prompt: ${chatTurnData.response?.entries?.[0]?.type}\n"${chatTurnData.response?.entries?.[0]?.prompt?.substring(0, 80)}..."`
						);
					} else {
						console.log(`  Content: Document data missing.`);
					}
				} catch (parseError) {
					console.log(`  Content: Error parsing document - ${results.documents?.[i]}`);
				}
				console.log('---');
			}
			if (results.ids.length > 3) {
				console.log(`(... and ${results.ids.length - 3} more documents)`);
				console.log('---');
			}
			console.log(`Total documents confirmed for session ${TARGET_SESSION_ID}: ${results.ids.length}`);
		}
	} catch (error) {
		console.error('Error checking seeded data:', error);
		process.exit(1);
	}
}

// --- Run the script ---
checkSeededData();
