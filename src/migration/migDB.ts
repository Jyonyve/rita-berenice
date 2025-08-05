import { ChromaClient, Metadata } from 'chromadb';

// --- Configuration ---

// Source DB: Your old Fly.io Chroma instance
const SOURCE_CONFIG = { host: 'chromadb-flyio.fly.dev', port: 443, ssl: true };

// Destination DB: Your new Fly.io Chroma instance
const DESTINATION_CONFIG = { host: 'rita-berenice-chromadb.fly.dev', port: 443, ssl: true };

// List of all collections to migrate
const COLLECTIONS_TO_MIGRATE = ['character', 'chat', 'temp', 'recap', 'lore', 'user'];
const BATCH_SIZE = 100;

// --- Script Logic ---

async function migrateCollection(
	sourceClient: ChromaClient,
	destClient: ChromaClient,
	collectionName: string
): Promise<void> {
	console.log(`\n--- Starting migration for collection: "${collectionName}" ---`);
	try {
		const sourceCollection = await sourceClient.getCollection({ name: collectionName });
		const destCollection = await destClient.getOrCreateCollection({ name: collectionName });

		const allRecords = await sourceCollection.get({ include: ['metadatas', 'documents'] });

		if (!allRecords || allRecords.ids.length === 0) {
			console.log(`Collection "${collectionName}" is empty. Nothing to migrate.`);
			return;
		}

		console.log(`Found ${allRecords.ids.length} records in source collection "${collectionName}".`);

		for (let i = 0; i < allRecords.ids.length; i += BATCH_SIZE) {
			const batchIds = allRecords.ids.slice(i, i + BATCH_SIZE);
			const batchMetadatas = allRecords.metadatas.slice(i, i + BATCH_SIZE);
			const batchDocuments = allRecords.documents.slice(i, i + BATCH_SIZE);

			console.log(
				`Upserting batch ${Math.floor(i / BATCH_SIZE) + 1} with ${batchIds.length} records...`
			);
			await destCollection.upsert({
				ids: batchIds,
				metadatas: batchMetadatas as Metadata[],
				documents: batchDocuments as string[],
			});
		}

		console.log(`✅ Successfully migrated collection: "${collectionName}"`);
	} catch (error) {
		console.error(`❌ Failed to migrate collection "${collectionName}":`, error);
	}
}

async function main() {
	console.log('Initializing ChromaDB clients...');

	const sourceClient = new ChromaClient(SOURCE_CONFIG);
	const destClient = new ChromaClient(DESTINATION_CONFIG);

	console.log('Starting full database migration...');

	for (const collectionName of COLLECTIONS_TO_MIGRATE) {
		await migrateCollection(sourceClient, destClient, collectionName);
	}

	console.log('\n🚀 Full migration process complete.');
}

main().catch(console.error);
