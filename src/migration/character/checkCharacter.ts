// Save this file as scripts/checkCharacterData.ts

import { COLLECTIONS } from '#server/index.js';
import { CharacterMetadata } from '#shared/domain/index.js';
import { ChromaClient, Collection, IncludeEnum } from 'chromadb';
import { METADATA_TYPES } from '#shared/config/constants.js';
// Adjust path based on your project structure

// --- Configuration ---
const CHROMA_URL = process.env.CHROMA_API_URL || 'https://chromadb-flyio.fly.dev'; // Use env var or default
const TARGET_COLLECTION_NAME = COLLECTIONS.CHARACTER; // The collection name for characters
// const TARGET_CHARACTER_ID = 'monday_original';
// const TARGET_CHARACTER_ID = 'tarion_original';
const TARGET_CHARACTER_ID = 'tarion_spinoff';

const EXPECTED_TYPE = METADATA_TYPES.CHARACTER;

// --- Main Checking Logic ---
async function checkCharacterData() {
	console.log(`Connecting to ChromaDB at: ${CHROMA_URL}`);
	const chroma = new ChromaClient({ path: CHROMA_URL });

	try {
		// 1. Get the Collection (use getOrCreate for robustness)
		console.log(`Accessing collection "${TARGET_COLLECTION_NAME}"...`);
		let collection: Collection;
		try {
			collection = await chroma.getOrCreateCollection({
				name: TARGET_COLLECTION_NAME,
				// metadata: { accessed_by_script: 'checkCharacterData.ts' }, // Minimal metadata
				// embeddingFunction: new DefaultEmbeddingFunction(), // Optional: If needed and collection doesn't exist
			});
			console.log(`Collection "${TARGET_COLLECTION_NAME}" accessed.`);
		} catch (error) {
			console.error(`Error accessing collection "${TARGET_COLLECTION_NAME}":`, error);
			process.exit(1);
			return; // Satisfy TS control flow analysis
		}

		// 2. Query the collection by the specific Character ID
		console.log(`Querying for document with ID: "${TARGET_CHARACTER_ID}"...`);
		const results = await collection.get({
			ids: [TARGET_CHARACTER_ID],
			include: [IncludeEnum.documents, IncludeEnum.metadatas],
		});

		// 3. Display Results and Check Data
		if (!results || results.ids.length === 0) {
			console.error(`\n--- CHECK FAILED ---`);
			console.error(
				`Error: Document with ID "${TARGET_CHARACTER_ID}" NOT FOUND in collection "${TARGET_COLLECTION_NAME}".`
			);
			console.error(`Possible Causes:`);
			console.error(`  - The 'initCharacter.ts' script did not run successfully.`);
			console.error(`  - The CHROMA_URL or Collection Name is incorrect.`);
			console.error(`  - The data was deleted.`);
			console.error(`--------------------\n`);
		} else {
			console.log(`\n--- CHECK SUCCESSFUL (Data Found) ---`);
			console.log(`Found 1 document for ID "${TARGET_CHARACTER_ID}":`);

			const retrievedMetadata = results.metadatas?.[0] as CharacterMetadata | null | undefined;
			const retrievedDocument = results.documents?.[0];

			console.log('\n--- Retrieved Metadata ---');
			console.log(JSON.stringify(retrievedMetadata, null, 2)); // Pretty print

			console.log('\n--- Retrieved Document (for embedding) ---');
			console.log(`"${retrievedDocument}"`);

			console.log('\n--- Verification Checks ---');
			let checksPassed = true;

			// Check Document Content
			// if (retrievedDocument === EXPECTED_DESCRIPTION) {
			// 	console.log(`✅ Document content matches expected description.`);
			// } else {
			// 	console.error(`❌ Document content MISMATCH.`);
			// 	console.error(`   Expected: "${EXPECTED_DESCRIPTION.substring(0, 50)}..."`);
			// 	console.error(`   Received: "${retrievedDocument?.substring(0, 50)}..."`);
			// 	checksPassed = false;
			// }

			// Check Metadata Type
			if (retrievedMetadata?.type === EXPECTED_TYPE) {
				console.log(`✅ Metadata 'type' field is correct ("${EXPECTED_TYPE}").`);
			} else {
				console.error(`❌ Metadata 'type' field MISMATCH or MISSING.`);
				console.error(`   Expected: "${EXPECTED_TYPE}"`);
				console.error(`   Received: "${retrievedMetadata?.type}"`);
				console.error(`   (This is CRITICAL for the 'getAllCharacters' API endpoint)`);
				checksPassed = false;
			}

			// Add more checks if needed (e.g., for instructions, showName)
			if (retrievedMetadata?.name === 'monday') {
				console.log(`✅ Metadata 'id' field is correct ("monday").`);
			} else {
				console.error(`❌ Metadata 'id' field MISMATCH or MISSING.`);
				checksPassed = false;
			}
			if (retrievedMetadata?.variant === 'original') {
				console.log(`✅ Metadata 'variant' field is correct ("original").`);
			} else {
				console.error(`❌ Metadata 'variant' field MISMATCH or MISSING.`);
				checksPassed = false;
			}

			if (checksPassed) {
				console.log('\n✅ All basic verification checks passed for the retrieved data.');
			} else {
				console.error(
					'\n❌ One or more verification checks failed. Review the metadata/document content.'
				);
			}

			console.log(`-------------------------------------\n`);
		}
	} catch (error) {
		console.error('\n--- SCRIPT ERROR ---');
		console.error('An unexpected error occurred while checking data:', error);
		console.error('------------------\n');
		process.exit(1);
	}
}

// --- Run the script ---
checkCharacterData();
