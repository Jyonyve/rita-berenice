import { OpenAIEmbeddingFunction } from '@chroma-core/openai';
import { METADATA_TYPES } from '@rita-berenice/shared/config';
import { ChromaClient, Where } from 'chromadb';

// --- Configuration ---
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
	throw new Error('FATAL: OPENAI_API_KEY secret is not set in the environment.');
}

const embedFnOpenAi = new OpenAIEmbeddingFunction({ apiKey, modelName: 'text-embedding-3-small' });

// The production database to clean
const DB_CONFIG = { host: 'rita-berenice-chromadb.fly.dev', port: 443, ssl: true };
const COLLECTION_NAME = 'chat';
const BATCH_SIZE = 200; // Process 200 records at a time

// --- Script Logic ---

async function cleanupUserMessages(): Promise<void> {
	const client = new ChromaClient(DB_CONFIG);

	try {
		const collection = await client.getCollection({
			name: COLLECTION_NAME,
			embeddingFunction: embedFnOpenAi,
		});

		// Define the filter to find the records we want to delete
		const whereFilter: Where = { type: { $eq: METADATA_TYPES.MESSAGE } };

		let totalDeletedCount = 0;
		let batchNumber = 1;

		// Loop until no more matching records are found
		while (true) {
			console.log(`Processing batch #${batchNumber}...`);

			// 1. Get a batch of records that match our filter
			const recordsToDelete = await collection.get({
				where: whereFilter,
				limit: BATCH_SIZE,
				include: [], // We only need the IDs, so no need to fetch documents or metadata
			});

			const idsToDelete = recordsToDelete.ids;

			// 2. If no more IDs are found, the cleanup is complete
			if (idsToDelete.length === 0) {
				console.log('No more "MESSAGE" records found for this user. Cleanup complete.');
				break;
			}

			console.log(`Found ${idsToDelete.length} records in this batch to delete.`);

			// 3. Delete the found records by their IDs
			await collection.delete({ ids: idsToDelete });

			totalDeletedCount += idsToDelete.length;
			console.log(`Deleted batch. Total records deleted so far: ${totalDeletedCount}`);

			batchNumber++;
		}

		console.log(
			`✅ Successfully finished cleanup. A total of ${totalDeletedCount} message records were deleted.`
		);
	} catch (error) {
		console.error(`❌ An error occurred during the cleanup process:`, error);
	}
}

async function main() {
	console.log('Starting the message cleanup script.');
	await cleanupUserMessages();
	console.log('\nScript has finished.');
}

main().catch(console.error);
