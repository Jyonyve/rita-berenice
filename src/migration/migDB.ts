import { OpenAIEmbeddingFunction } from '@chroma-core/openai';
import { ChromaClient, Metadata } from 'chromadb';

// --- Configuration ---
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
	// This check is important. It will cause the server to crash on startup
	// if the secret is not set, which is good practice (fail fast).
	throw new Error('FATAL: OPENAI_API_KEY secret is not set in the environment.');
}

const embedFnOpenAi = new OpenAIEmbeddingFunction({ apiKey, modelName: 'text-embedding-3-small' });

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
        const sourceCollection = await sourceClient.getCollection({
            name: collectionName,
            embeddingFunction: embedFnOpenAi,
        });
        const destCollection = await destClient.getOrCreateCollection({
            name: collectionName,
            embeddingFunction: embedFnOpenAi,
            metadata: { name: collectionName, created: new Date().toISOString() },
        });

        // First, get the total number of records to process
        const totalRecords = await sourceCollection.count();
        if (totalRecords === 0) {
            console.log(`Collection "${collectionName}" is empty. Nothing to migrate.`);
            return;
        }

        console.log(`Found ${totalRecords} total records in source collection "${collectionName}".`);

        // Loop through the source collection using pagination
        for (let offset = 0; offset < totalRecords; offset += BATCH_SIZE) {
            console.log(`Fetching batch from source at offset ${offset}...`);
            
            // 1. Fetch one batch from the source using limit and offset
            const batch = await sourceCollection.get({
                limit: BATCH_SIZE,
                offset: offset,
                include: ['metadatas', 'documents']
            });

            if (!batch.ids || batch.ids.length === 0) {
                // This condition prevents an infinite loop if something goes wrong
                break;
            }

            console.log(`Upserting batch ${Math.floor(offset / BATCH_SIZE) + 1} with ${batch.ids.length} records...`);

            // 2. Upsert that same batch to the destination
            await destCollection.upsert({
                ids: batch.ids,
                metadatas: batch.metadatas as Metadata[],
                documents: batch.documents as string[],
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