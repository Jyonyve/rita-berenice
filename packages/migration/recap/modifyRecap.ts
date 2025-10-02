// scripts/recap/modifyRecapIds.ts

import { chromaDbClient, COLLECTIONS, toChromaMetadata } from '@rita-berenice/server/db';
import { recapStore } from '@rita-berenice/server/store';
import { METADATA_TYPES } from '@rita-berenice/shared/config';
import { RecapInfo } from '@rita-berenice/shared/domain';
import { buildRecapId, metadataToRecap, recapToMetadata } from '@rita-berenice/shared/util';
import { Metadata } from 'chromadb';

const BATCH_SIZE = 50; // Process records in batches to avoid overwhelming the database
/**
 * A utility function to break a large array into smaller chunks.
 */
function chunkArray<T>(arr: T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < arr.length; i += size) {
		chunks.push(arr.slice(i, i + size));
	}
	return chunks;
}

/**
 * Fetches all recap records, identifies those with incorrect IDs,
 * creates new records with corrected IDs, and deletes the old ones.
 */
async function modifyRecapIds() {
	console.log(`🚀 Starting recap ID migration script...`);

	try {
		// 1. Get all recap records from the database
		console.log(`   [1/4] Fetching all recap records from collection: "${COLLECTIONS.RECAP}"...`);
		const recapCollection = await chromaDbClient.getRecapCollection();
		const allRecapsResponse = await chromaDbClient.getRecordsByMetadataType(
			recapCollection,
			METADATA_TYPES.RECAP
		);

		if (!allRecapsResponse.ids || allRecapsResponse.ids.length === 0) {
			console.log('✅ No recap records found. Nothing to do.');
			return;
		}
		console.log(`   Found ${allRecapsResponse.ids.length} total recap records.`);

		// 2. Identify records that need to be migrated
		const recordsToUpsert: { id: string; document: string; metadata: Metadata }[] = [];
		const idsToDelete: string[] = [];

		for (let i = 0; i < allRecapsResponse.ids.length; i++) {
			const oldId = allRecapsResponse.ids[i];
			const metadata = allRecapsResponse.metadatas[i] as Metadata;
			const content = allRecapsResponse.documents[i] || '';

			// Reconstruct the RecapInfo object from the metadata
			console.log(oldId);
			const document = JSON.stringify({ content });
			const recapInfo = metadataToRecap(metadata as any, content);

			// Generate the new, correct ID using the `turnStart` sequence
			const newId = buildRecapId(recapInfo.sessionId, recapInfo.turnStart, recapInfo.turnEnd);

			if (oldId !== newId) {
				// The ID is incorrect and needs migration
				idsToDelete.push(oldId);

				// Create a new recap object with the corrected ID
				const correctedRecapInfo: RecapInfo = {
					...recapInfo,
					recapId: newId,
					updatedAt: new Date().toISOString(), // Mark the update time
				};

				recordsToUpsert.push({
					id: newId,
					document,
					metadata: recapToMetadata(correctedRecapInfo) as any,
				});
			}
		}

		if (recordsToUpsert.length === 0) {
			console.log('✅ All recap IDs are already correct. No migration needed.');
			return;
		}

		console.log(`   [2/4] Identified ${recordsToUpsert.length} records that require ID correction.`);

		// 3. Batch upsert the corrected records
		console.log(`   [3/4] Upserting corrected records...`);
		const upsertBatches = chunkArray(recordsToUpsert, BATCH_SIZE);
		for (const [index, batch] of upsertBatches.entries()) {
			console.log(`      -> Upserting batch ${index + 1}/${upsertBatches.length}...`);
			await chromaDbClient.upsertRecords(
				recapCollection,
				batch.map((r) => r.id),
				batch.map((r) => r.document),
				batch.map((r) => toChromaMetadata(r.metadata))
			);
		}

		// 4. Batch delete the old, incorrect records
		console.log(`   [4/4] Deleting old records with incorrect IDs...`);
		const deleteBatches = chunkArray(idsToDelete, BATCH_SIZE);
		for (const [index, batch] of deleteBatches.entries()) {
			console.log(`      -> Deleting batch ${index + 1}/${deleteBatches.length}...`);
			await chromaDbClient.deleteRecords(recapCollection, batch);
		}

		console.log(`\n🎉 Success! Corrected the IDs for ${recordsToUpsert.length} recap records.`);
	} catch (error: any) {
		console.error('❌ An error occurred during the migration:', error);
		process.exit(1);
	}
}

async function checkRecap(sessionId: string) {
	const recapInfos = await recapStore.getRecapsBySessionId(sessionId, 'recap');
	console.log(recapInfos[0]);
	console.log(recapInfos[1]);
	console.log(recapInfos[2]);
}
// --- Run the script ---
// const sessionId = process.argv[2];
modifyRecapIds();
// createConsolidatedRecapDoc(sessionId, 'recap');
// checkRecap(sessionId);
