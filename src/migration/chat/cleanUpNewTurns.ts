// scripts/chat/cleanupNewTurns.ts

import { chatStore } from '#server/store/chatStore.js';
import { chromaDbClient } from '#server/db/chromaDbClient.js';

/**
 * Deletes chat turns for a specific session based on sequence number.
 * This can be used to clean up specific ranges or recent high-sequence insertions.
 * @param sessionId The ID of the session to clean up.
 * @param minSequence The minimum sequence number to consider for deletion (inclusive).
 * @param maxSequence The maximum sequence number to consider for deletion (inclusive, optional).
 */
async function cleanupTurnsBySequence(
	sessionId: string,
	minSequence: number,
	maxSequence?: number
) {
	console.log(`🚀 Starting cleanup for session: ${sessionId}`);
	console.log(
		`🎯 Targeting records with sequence numbers from ${minSequence}${maxSequence !== undefined ? ` to ${maxSequence}` : ' upwards'}.`
	);

	const { displayTurns: chatTurns } = await chatStore.getAllChatTurns(sessionId);
	if (!chatTurns || chatTurns.length === 0) {
		console.log('✅ No turns found for this session. Nothing to do.');
		return;
	}

	const idsToDelete = chatTurns
		.filter((turn) => {
			const isAboveMin = turn.sequence >= minSequence;
			const isBelowMax = maxSequence === undefined || turn.sequence <= maxSequence;
			return isAboveMin && isBelowMax;
		})
		.map((turn) => turn.chatTurnId);

	if (idsToDelete.length === 0) {
		console.log(`✅ No records found in the specified sequence range. Nothing to delete.`);
		return;
	}

	console.log(`🗑️ Found ${idsToDelete.length} records to delete.`);
	console.log('IDs to be deleted:', idsToDelete);

	try {
		const collection = await chromaDbClient.getChatCollection();
		console.log(await collection.get({ ids: idsToDelete.slice(0, 3) }));
		// await chromaDbClient.deleteRecords(collection, idsToDelete);
		console.log(`✅ Successfully deleted ${idsToDelete.length} records.`);
	} catch (error) {
		console.error('💥 Failed to delete records from the database:', error);
	}
}

// --- Script Execution ---
const sessionId = process.argv[2];
const minSeq = parseInt(process.argv[3], 10);
const maxSeq = process.argv[4] ? parseInt(process.argv[4], 10) : undefined;

if (!sessionId || isNaN(minSeq)) {
	console.error('🚨 Please provide sessionId and a minimum sequence number.');
	console.error(
		'Usage: tsx ./scripts/chat/cleanupNewTurns.ts <sessionId> <minSequence> [maxSequence]'
	);
	process.exit(1);
}

cleanupTurnsBySequence(sessionId, minSeq, maxSeq).catch((err) => {
	console.error('FATAL ERROR:', err);
	process.exit(1);
});
