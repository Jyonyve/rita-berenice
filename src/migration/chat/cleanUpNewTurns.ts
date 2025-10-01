// scripts/chat/cleanupNewTurns.ts

import { chatStore } from '#server/store/chatStore.js';
import { chromaDbClient } from '#server/db/chromaDbClient.js';
import { Where } from 'chromadb';
import { buildChatTurnId } from '#shared/util/buildIdUtils.js';

/**
 * Atomically deletes chat turns and all their associated index records
 * for a session based on a specified sequence number range.
 * This version generates IDs and uses a single bulk delete operation.
 *
 * @param sessionId The ID of the session to clean up.
 * @param minSequence The minimum sequence number to delete from (inclusive).
 * @param maxSequence The maximum sequence number to delete up to (inclusive, optional).
 */
async function cleanupTurnsByGeneratedIds(
	sessionId: string,
	minSequence: number,
	maxSequence?: number
) {
	console.log(`🚀 Starting ATOMIC cleanup for session: ${sessionId}`);
	console.log(
		`🎯 Targeting records with sequence numbers from ${minSequence}${maxSequence !== undefined ? ` to ${maxSequence}` : ' upwards'}.`
	);

	// 1. Find the actual highest sequence number for this session to create an upper bound.
	const chatResponse = await chatStore.getAllDisplayTurns(sessionId);
	const allTurnsForSession = chatResponse.displayTurns || [];

	if (allTurnsForSession.length === 0) {
		console.log('✅ No turns found for this session. Nothing to do.');
		return;
	}

	const highestSequenceInDB = Math.max(...allTurnsForSession.map((t) => t.sequence));
	const effectiveMaxSequence =
		maxSequence !== undefined ? Math.min(maxSequence, highestSequenceInDB) : highestSequenceInDB;

	if (minSequence > effectiveMaxSequence) {
		console.log(
			`✅ minSequence (${minSequence}) is higher than the max sequence in the DB (${effectiveMaxSequence}). Nothing to delete.`
		);
		return;
	}

	// 2. Generate the list of chatTurnId's to be deleted.
	const idsToDelete: string[] = [];
	for (let i = minSequence; i <= effectiveMaxSequence; i++) {
		idsToDelete.push(buildChatTurnId(sessionId, i));
	}

	if (idsToDelete.length === 0) {
		console.log(
			`✅ No IDs were generated for the sequence range ${minSequence}-${effectiveMaxSequence}. Nothing to delete.`
		);
		return;
	}

	console.log(
		`🗑️ Generated ${idsToDelete.length} chatTurnIds to delete, from sequence ${minSequence} to ${effectiveMaxSequence}.`
	);
	console.log(`   - Example IDs: [${idsToDelete.slice(0, 5).join(', ')}]`);

	// 3. Perform a single, atomic bulk delete using a where clause.
	// This targets ALL records (both TURN and INDEX types) that have a matching chatTurnId.
	try {
		const collection = await chromaDbClient.getChatCollection();

		const whereClause: Where = { chatTurnId: { $in: idsToDelete } };

		await chromaDbClient.deleteRecords(collection, undefined, whereClause);

		console.log(
			`✅ Successfully submitted atomic deletion request for ${idsToDelete.length} turn groups.`
		);

		// 4. Optional: Verify deletion.
		console.log('🔍 Verifying deletion...');
		const verificationResult = await collection.get({ where: whereClause, limit: 1 });
		if (verificationResult.ids.length === 0) {
			console.log('👍 Verification successful: No records with the targeted chatTurnIds were found.');
		} else {
			console.warn(
				'⚠️ Verification warning: Some targeted records were still found.',
				verificationResult
			);
		}
	} catch (error) {
		console.error('💥 Failed to delete records from ChromaDB:', error);
	}
}

// --- Script Execution Logic ---
const sessionId = process.argv[2];
const minSeq = parseInt(process.argv[3], 10);
const maxSeq = process.argv[4] ? parseInt(process.argv[4], 10) : undefined;

if (!sessionId || isNaN(minSeq)) {
	console.error('🚨 Please provide a valid sessionId and a minimum sequence number.');
	console.error(
		'Usage: tsx ./scripts/chat/cleanupNewTurns.ts <sessionId> <minSequence> [maxSequence]'
	);
	process.exit(1);
}

if (maxSeq !== undefined && isNaN(maxSeq)) {
	console.error('🚨 If provided, maxSequence must be a valid number.');
	process.exit(1);
}

cleanupTurnsByGeneratedIds(sessionId, minSeq, maxSeq).catch((err) => {
	console.error('FATAL SCRIPT ERROR:', err);
	process.exit(1);
});
