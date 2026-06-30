import { OpenAIEmbeddingFunction } from '@chroma-core/openai';
import { ChromaClient, Metadata, Where } from 'chromadb';
import { buildProfileId, buildSessionId } from '#shared/util/buildIdUtils.js';
import { SessionInfo, SessionMetadata } from '#shared/domain/session/SessionInterfaces.js';
import { ProfileInfo } from '#shared/domain/profile/ProfileInterfaces.js';
import { COLLECTIONS, flatProfileToDoc, flatSessionToDoc } from '../server/index.ts';
import { METADATA_TYPES } from '../shared/index.ts';
import fs from 'fs';
import readline from 'node:readline';
import { ChatTurn } from '#shared/domain/chat/ChatInterfaces.js';
import { chatStore } from '#server/store/chatStore.js';
import { CohereEmbeddingFunction } from '@chroma-core/cohere';

// --- Configuration ---
const openAiApiKey = process.env.OPENAI_API_KEY;
const cohereApiKey = process.env.COHERE_API_KEY;
if (!openAiApiKey) {
	// This check is important. It will cause the server to crash on startup
	// if the secret is not set, which is good practice (fail fast).
	throw new Error('FATAL: OPENAI_API_KEY secret is not set in the environment.');
}

const embedFnOpenAi = new OpenAIEmbeddingFunction({
	apiKey: openAiApiKey,
	modelName: 'text-embedding-3-small',
});
const embedFnCohere = new CohereEmbeddingFunction({
	apiKey: cohereApiKey,
	modelName: 'embed-english-v3.0', // A common choice for search documents
	inputType: 'search_document',
});

// Source DB: Your old Fly.io Chroma instance
const SOURCE_CONFIG = { host: 'chromadb-flyio.fly.dev', port: 443, ssl: true };
// Destination DB: Your new Fly.io Chroma instance
// const DESTINATION_CONFIG = { host: 'rita-berenice-chromadb.fly.dev', port: 443, ssl: true };
const DESTINATION_CONFIG = { host: 'localhost', port: 8000 };
// --- Configuration ---
// The old development ID to find and replace.
const USER_ID_OLD = '6b335673-c837-43f9-a1c7-0b92c90edefb';
// const USER_ID_NEW = '6b335673-c837-43f9-a1c7-0b92c90edefb';

// The new production ID to replace it with.
const USER_ID_NEW = 'dbce0624-7eb1-4e0f-85d2-d25333996992';
// const USER_ID_OLD = 'dbce0624-7eb1-4e0f-85d2-d25333996992';

const CHAT_JSONL_PATH =
	'C:/Users/nextree/Favorites/rita-berenice-task/src/migration/chat/backup/taryeon_original_3rTcSTNS.jsonl';

// List of collections to migrate from the remote source
const COLLECTIONS_TO_MIGRATE = ['character', 'recap', 'lore', 'term'];
const BATCH_SIZE = 50; // Use a smaller batch size since storeChatTurns does more work (indexing)

// --- REFACTORED: Migrate Chat using chatStore ---

async function migrateChatFromJsonl(filePath: string): Promise<void> {
	console.log(`\n--- Starting CHAT migration from local file: "${filePath}" ---`);

	if (!fs.existsSync(filePath)) {
		console.error(`❌ Error: File not found at path: ${filePath}`);
		return;
	}

	try {
		const fileStream = fs.createReadStream(filePath);
		const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

		let chatTurnBatch: ChatTurn[] = [];
		let totalLines = 0;

		for await (const line of rl) {
			if (line.trim() === '') continue;

			// The JSONL file should contain full ChatTurn objects
			const turn: ChatTurn = JSON.parse(line);
			chatTurnBatch.push(turn);
			totalLines++;

			// When the batch is full, store it using your existing logic
			if (chatTurnBatch.length >= BATCH_SIZE) {
				console.log(`Storing batch of ${chatTurnBatch.length} chat turns via chatStore...`);
				await chatStore.storeChatTurns(chatTurnBatch);
				chatTurnBatch = []; // Reset for the next batch
			}
		}

		// Store any remaining records in the final batch
		if (chatTurnBatch.length > 0) {
			console.log(`Storing final batch of ${chatTurnBatch.length} chat turns...`);
			await chatStore.storeChatTurns(chatTurnBatch);
		}

		console.log(`✅ Successfully migrated ${totalLines} records to CHAT collection using chatStore.`);
	} catch (error) {
		console.error(`❌ Failed to migrate CHAT collection from JSONL:`, error);
	}
}

async function migrateCollection(
	sourceClient: ChromaClient,
	destClient: ChromaClient,
	collectionName: string,
	embeddingFunction: CohereEmbeddingFunction | OpenAIEmbeddingFunction = embedFnOpenAi // Default to OpenAI
): Promise<void> {
	console.log(
		`\n--- Starting migration for collection: "${collectionName}" (Using ${embeddingFunction.constructor.name}) ---`
	);
	try {
		// Get source collection (it will use its original embedding function for retrieval)
		const sourceCollection = await sourceClient.getCollection({ name: collectionName });

		// Create destination collection with the SPECIFIED embedding function
		const destCollection = await destClient.getOrCreateCollection({
			name: collectionName,
			embeddingFunction: embeddingFunction, // Use the passed function here
			metadata: { name: collectionName, created: new Date().toISOString() },
		});

		const totalRecords = await sourceCollection.count();
		if (totalRecords === 0) {
			console.log(`Collection "${collectionName}" is empty. Nothing to migrate.`);
			return;
		}
		console.log(`Found ${totalRecords} total records in source collection "${collectionName}".`);

		for (let offset = 0; offset < totalRecords; offset += BATCH_SIZE) {
			console.log(`Fetching batch from source at offset ${offset}...`);
			const batch = await sourceCollection.get({
				limit: BATCH_SIZE,
				offset: offset,
				include: ['metadatas', 'documents'], // We get documents, new embeddings will be generated on upsert
			});

			if (!batch.ids || batch.ids.length === 0) break;

			console.log(
				`Upserting batch ${Math.floor(offset / BATCH_SIZE) + 1} with ${batch.ids.length} records...`
			);
			// When upserting to destCollection, it will automatically use the new embedding function (e.g., Cohere)
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

async function migrateMissingTurns(sourceClient: ChromaClient, destClient: ChromaClient) {
	console.log(`🚀 Starting migration of missing 'TURN' records...`);

	const COLLECTION_NAME = COLLECTIONS.CHAT;
	try {
		console.log(`\n--- Accessing collection: "${COLLECTION_NAME}" ---`);
		const sourceCollection = await sourceClient.getCollection({
			name: COLLECTION_NAME,
			embeddingFunction: embedFnOpenAi,
		});
		const destCollection = await destClient.getOrCreateCollection({
			name: COLLECTION_NAME,
			embeddingFunction: embedFnOpenAi,
		});

		// Filter for TURN records belonging to the OLD user ID from the source.
		const whereFilter: Where = {
			$and: [{ type: { $eq: METADATA_TYPES.TURN } }, { userId: { $eq: USER_ID_OLD } }],
		};

		const recordsToCount = await sourceCollection.get({ where: whereFilter, include: [] });
		const totalTurnsToUpdate = recordsToCount.ids.length;

		if (totalTurnsToUpdate === 0) {
			console.log("✅ No 'TURN' records found for the old user ID in the source DB. Nothing to do.");
			return;
		}

		console.log(`   Found ${totalTurnsToUpdate} 'TURN' records to migrate.`);

		for (let offset = 0; offset < totalTurnsToUpdate; offset += BATCH_SIZE) {
			console.log(`   Fetching batch from SOURCE DB starting at offset ${offset}...`);

			// *** CORRECTED: Get data from the sourceCollection ***
			const batchToMigrate = await sourceCollection.get({
				where: whereFilter,
				limit: BATCH_SIZE,
				offset: offset,
				include: ['metadatas', 'documents'],
			});

			if (batchToMigrate.ids.length === 0) break;

			const updatedMetadatas: any[] = [];

			// Transform the metadata for the new user ID.
			// for (const oldMeta of batchToMigrate.metadatas) {
			// 	if (!oldMeta) continue;
			// 	updatedMetadatas.push({
			// 		...oldMeta,
			// 		userId: USER_ID_NEW,
			// 		profileId: buildProfileId(oldMeta.sessionId as string, USER_ID_NEW),
			// 	});
			// }

			console.log(`   Upserting batch of ${batchToMigrate.ids.length} records to DESTINATION DB...`);

			// *** CORRECTED: Upsert the modified data into the destCollection ***
			// await destCollection.upsert({
			// 	ids: batchToMigrate.ids,
			// 	metadatas: updatedMetadatas,
			// 	documents: batchToMigrate.documents as string[],
			// });
			await destCollection.upsert({
				ids: batchToMigrate.ids,
				metadatas: batchToMigrate.metadatas as Metadata[],
				documents: batchToMigrate.documents as string[],
			});

			console.log(`   ✅ Batch successfully migrated.`);
		}

		console.log(`\n🎉 Successfully migrated ${totalTurnsToUpdate} 'TURN' records.`);
	} catch (error) {
		console.error('❌ An error occurred during the update process:', error);
	}
}

async function migrateUserAndProfileIds(client: ChromaClient, collectionName: string) {
	console.log(`🚀 Starting User ID migration from ${USER_ID_OLD} to ${USER_ID_NEW}`);

	try {
		console.log(`\n--- Processing collection: "${collectionName}" ---`);
		const collection = await client.getCollection({ name: collectionName });

		// This filter efficiently fetches only the records we need to change.
		const whereFilter: Where = { userId: { $eq: USER_ID_OLD } };
		let totalUpdated = 0;

		while (true) {
			// 1. Get a batch of records matching the old user ID.
			const recordsToMigrate = await collection.get({
				where: whereFilter,
				limit: BATCH_SIZE,
				include: ['metadatas', 'documents'],
			});

			if (recordsToMigrate.ids.length === 0) {
				// No more records with the old ID are found in this collection.
				break;
			}

			console.log(`   Found a batch of ${recordsToMigrate.ids.length} records to migrate...`);

			const newIds: string[] = [];
			const newMetadatas: any[] = [];

			for (let i = 0; i < recordsToMigrate.ids.length; i++) {
				const oldId = recordsToMigrate.ids[i];
				const oldMetadata = recordsToMigrate.metadatas[i];

				// 2. Create the new, updated versions of the IDs and metadata.
				// This handles composite keys that include the user ID.
				const newId = oldId.includes(USER_ID_OLD) ? oldId.replace(USER_ID_OLD, USER_ID_NEW) : oldId;
				newIds.push(newId);

				const newMetadata = { ...oldMetadata };
				newMetadata.userId = USER_ID_NEW;

				if (typeof newMetadata.profileId === 'string' && newMetadata.profileId.includes(USER_ID_OLD)) {
					newMetadata.profileId = newMetadata.profileId.replace(USER_ID_OLD, USER_ID_NEW);
				}
				if (typeof newMetadata.sessionId === 'string' && newMetadata.sessionId.includes(USER_ID_OLD)) {
					newMetadata.sessionId = newMetadata.sessionId.replace(USER_ID_OLD, USER_ID_NEW);
				}
				newMetadatas.push(newMetadata);
			}

			// 3. Add the new records with the updated information.
			await collection.add({
				ids: newIds,
				metadatas: newMetadatas,
				documents: recordsToMigrate.documents as string[],
			});

			// 4. Delete the old records now that the new ones are safely stored.
			await collection.delete({ ids: recordsToMigrate.ids });

			console.log(`   ✅ Batch of ${recordsToMigrate.ids.length} records successfully migrated.`);
			totalUpdated += recordsToMigrate.ids.length;
		}

		if (totalUpdated > 0) {
			console.log(
				`--- Finished collection "${collectionName}". Total records migrated: ${totalUpdated} ---`
			);
		} else {
			console.log(`--- No records with old user ID found in collection "${collectionName}". ---`);
		}
	} catch (error) {
		console.error(`❌ Failed to migrate collection "${collectionName}":`, error);
	}

	console.log('\n🎉 Full User ID migration process complete.');
}

async function migrateSessionAndProfileData(sourceClient: ChromaClient, destClient: ChromaClient) {
	console.log(`🚀 Starting Session and Profile migration from ${USER_ID_OLD} to ${USER_ID_NEW}`);

	try {
		// --- 1. Migrate Profile Collection ---
		console.log('\n--- Processing collection: "profile" ---');
		const sourceProfileCollection = await sourceClient.getCollection({
			name: 'profile',
			embeddingFunction: embedFnOpenAi,
		});
		const destProfileCollection = await destClient.getOrCreateCollection({
			name: 'profile',
			embeddingFunction: embedFnOpenAi,
			metadata: { name: 'profile', created: new Date().toISOString() },
		});
		const oldProfiles = await sourceProfileCollection.get({
			where: { userId: { $eq: USER_ID_OLD } },
		});

		if (oldProfiles.ids.length > 0) {
			const newProfileInfos: ProfileInfo[] = oldProfiles.metadatas.map((meta: any) => ({
				...meta,
				userId: USER_ID_NEW,
				profileId: buildProfileId(meta.sessionId, USER_ID_NEW), // Generate new profileId
			}));

			await destProfileCollection.upsert({
				ids: newProfileInfos.map((p) => p.profileId),
				metadatas: newProfileInfos.map((p) => {
					const { description, ...metadata } = p;
					return metadata;
				}),
				documents: newProfileInfos.map((p) => flatProfileToDoc(p)),
			});
			console.log(`   ✅ Migrated ${newProfileInfos.length} profile records.`);
		} else {
			console.log('   No profile records found for the old user ID.');
		}

		// --- 2. Migrate Session Collection ---
		console.log('\n--- Processing collection: "session" ---');
		const sourceSessionCollection = await sourceClient.getCollection({
			name: 'session',
			embeddingFunction: embedFnOpenAi,
		});
		const destSessionCollection = await destClient.getOrCreateCollection({
			name: 'session',
			embeddingFunction: embedFnOpenAi,
			metadata: { name: 'session', created: new Date().toISOString() },
		});
		const oldSessions = await sourceSessionCollection.get({
			where: { userId: { $eq: USER_ID_OLD } },
		});

		if (oldSessions.ids.length > 0) {
			const newSessionInfos: SessionInfo[] = oldSessions.metadatas.map((meta: any) => ({
				...meta,
				userId: USER_ID_NEW,
				profileId: buildProfileId(meta.sessionId, USER_ID_NEW), // Generate corresponding new profileId
			}));

			await destSessionCollection.upsert({
				ids: newSessionInfos.map((s) => s.sessionId),
				metadatas: newSessionInfos.map((sessionInfo) => {
					return {
						sessionId: sessionInfo.sessionId,
						userId: sessionInfo.userId,
						profileId: sessionInfo.profileId,
						characterId: sessionInfo.characterId,
						title: sessionInfo.title,
						createdAt: sessionInfo.createdAt,
						updatedAt: sessionInfo.updatedAt,
						messageCount: sessionInfo.messageCount,
						status: sessionInfo.status,
						type: sessionInfo.type,
					};
				}),
				documents: newSessionInfos.map((s) => flatSessionToDoc(s)),
			});
			console.log(`   ✅ Migrated ${newSessionInfos.length} session records.`);
		} else {
			console.log('   No session records found for the old user ID.');
		}
	} catch (error) {
		console.error('❌ An error occurred during the migration:', error);
	}

	console.log('\n🎉 Session and Profile migration complete.');
}

//// main ////

async function main() {
	console.log('Initializing ChromaDB clients...');
	const sourceClient = new ChromaClient(SOURCE_CONFIG);
	const destClient = new ChromaClient(DESTINATION_CONFIG);

	console.log('Starting full database migration...');
	// await migrateMissingTurns(sourceClient, destClient);
	// await migrateSessionAndProfileData(sourceClient, destClient);
	await migrateCollection(sourceClient, destClient, 'temp', embedFnCohere);
	for (const collectionName of COLLECTIONS_TO_MIGRATE) {
		await migrateCollection(sourceClient, destClient, collectionName);
		// await migrateUserAndProfileIds(destClient, collectionName);
	}
	// await migrateChatFromJsonl(CHAT_JSONL_PATH);

	console.log('\n🚀 Full migration process complete.');
}

main().catch(console.error);
