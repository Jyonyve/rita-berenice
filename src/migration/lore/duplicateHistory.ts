// src/migration/util/duplicateHistory.ts

import { loreStore } from '#server/index.js';
import { HistoryInfo } from '#shared/domain/lore/LoreInterfaces.js';
import { buildHistoryId } from '#server/util/buildIdUtils.js';

// --- Configuration ---
const TARGET_HISTORY_IDS = [
	'tarion-childhood-dream_A8XfCrcf_history',
	'teachings-kassar-revenge_Ua8eOqsB_history',
];

// The character ID of the source histories.
// We need this to fetch them efficiently.
const SOURCE_CHARACTER_ID = 'tarion_original';

// The new values you want to set.
const NEW_USER_ID = 'sunfish';
const SPINOFF_CHARACTER_ID = 'tarion_spinoff';

/**
 * A script to duplicate specific history entries, modifying their userId and characterId.
 */
async function duplicateHistoryEntries() {
	console.log('🚀 Starting history duplication script...');

	try {
		// --- Step 1: Fetch the original history entries ---
		// --- Step 1: Fetch the original history entries ---
		console.log(`\n1. Fetching original histories for character: ${SOURCE_CHARACTER_ID}`);
		// Use the loreStore to get all histories for the source character.
		const { histories: allOriginalHistories } = await loreStore.getHistories(SOURCE_CHARACTER_ID);

		// Filter down to the specific two records we care about.
		const sourceHistories = allOriginalHistories.filter((h) =>
			TARGET_HISTORY_IDS.includes(h.historyId)
		);

		if (sourceHistories.length !== TARGET_HISTORY_IDS.length) {
			console.error(
				'❌ Error: Could not find all target history entries. Found:',
				sourceHistories.map((h) => h.historyId)
			);
			throw new Error('Could not find all target history entries. Aborting.');
		}
		console.log(`   -> ✅ Found ${sourceHistories.length} target history entries.`);

		// --- Step 2: UPDATE the original records with the new userId ---
		console.log(
			`\n2. Updating userId for ${sourceHistories.length} original records to '${NEW_USER_ID}'...`
		);

		for (const originalHistory of sourceHistories) {
			// Create a new object with the updated userId.
			const updatedOriginalHistory: HistoryInfo = {
				...originalHistory,
				userId: NEW_USER_ID,
				updatedAt: new Date().toISOString(), // It's good practice to update the timestamp.
			};

			// Use storeHistory, which performs an upsert. Since the historyId is the same,
			// this will overwrite the existing record with the updated data.
			await loreStore.storeHistory(updatedOriginalHistory);
			console.log(`   -> ✅ Updated: ${originalHistory.historyId}`);
		}
		// --- Step 3: CREATE new records for the spinoff character ---
		console.log(
			`\n3. Creating ${sourceHistories.length} new records for character: '${SPINOFF_CHARACTER_ID}'...`
		);

		for (const originalHistory of sourceHistories) {
			// Create a new record based on the original, but with multiple changes.
			const newSpinoffHistory: HistoryInfo = {
				...originalHistory, // Start with the original's data
				userId: NEW_USER_ID,
				characterId: SPINOFF_CHARACTER_ID,

				// IMPORTANT: Generate a new, unique historyId for the new record.
				historyId: buildHistoryId(originalHistory.englishId),

				// Also update character arrays to only reference the new character.
				ownerCharacterIdArray: [SPINOFF_CHARACTER_ID],
				// allAffectedCharacterIdArray: [SPINOFF_CHARACTER_ID],

				// Reset timestamps for the new creation.
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};

			// Store the new record. Since the historyId is new, this will be a fresh creation.
			await loreStore.storeHistory(newSpinoffHistory);
			console.log(
				`   -> ✅ Created: ${newSpinoffHistory.historyId} (from ${originalHistory.historyId})`
			);
		}

		console.log('\n🎉 Script completed successfully!');
	} catch (error) {
		console.error('🚨🚨🚨 FATAL Error during script execution:', error);
		process.exit(1);
	}
}

// --- Run the script ---
duplicateHistoryEntries();
