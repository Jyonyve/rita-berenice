// --- !!! DANGEROUS AREA !!! ---
// Define the sessionIDs you want to KEEP. All others will be deleted.

import { chromaDbClient, CollectionType } from '@rita-berenice/server/db';
import { Where } from 'chromadb';

// Double and triple-check these IDs.
const SESSION_IDS_TO_KEEP = [
	'taryeon_original_cWRM1T3x',
	'taryeon_spinoff_9gsTh0LA',
	'monday_original_1sYD76a4', // Add any other sessions you want to preserve
];

const COLLECTIONS_TO_PURGE: CollectionType[] = ['chat', 'temp', 'session', 'term', 'profile']; // Target collections with session-specific data

/**
 * Deletes all records from specified collections EXCEPT for those matching a whitelist of session IDs.
 */
async function purgeTestData() {
	console.log('--- Starting Test Data Purge from Production DB ---');
	console.warn('WARNING: This is a destructive operation. Make sure you have a backup.');

	// A simple 5-second countdown to prevent accidental runs
	for (let i = 5; i > 0; i--) {
		console.log(`Starting in ${i}...`);
		await new Promise((res) => setTimeout(res, 1000));
	}

	console.log('Connected to Production DB.');

	for (const collectionName of COLLECTIONS_TO_PURGE) {
		try {
			console.log(`\nProcessing collection: "${collectionName}"...`);
			const collection = await chromaDbClient.getOrCreateSingletonCollection(collectionName);

			// Define the 'where' filter to target all sessions NOT in our whitelist
			const whereFilter: Where = {
				sessionId: {
					$nin: SESSION_IDS_TO_KEEP, // "$nin" means "not in"
				},
			};

			// Delete records matching the filter
			// Note: The ChromaDB client delete method takes IDs, so we first get the IDs to delete.
			const recordsToDelete = await collection.get({ where: whereFilter, include: [] }); // include: [] to only get IDs

			if (recordsToDelete.ids.length > 0) {
				console.log(
					`Found ${recordsToDelete.ids.length} test records to delete from "${collectionName}".`
				);
				await collection.delete({ ids: recordsToDelete.ids });
				console.log(`✅ Successfully purged test data from "${collectionName}".`);
			} else {
				console.log(`No test data found to purge in "${collectionName}".`);
			}
		} catch (error) {
			console.error(`❌ Failed to purge data from collection "${collectionName}":`, error);
		}
	}

	console.log('\n--- Test Data Purge Complete ---');
}

// Run the script
purgeTestData().catch((error) => {
	console.error('A critical error occurred during the purge process:', error);
	process.exit(1);
});
