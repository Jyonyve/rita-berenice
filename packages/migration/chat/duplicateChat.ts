// scripts/chat/duplicateChat.ts

import { chatStore } from '@rita-berenice/server/store';
import { ChatTurn } from '@rita-berenice/shared/domain';
import {
	buildChatTurnId,
	buildMessageId,
	buildSessionId,
	parseSessionId,
} from '@rita-berenice/shared/util';

const BATCH_SIZE = 100;

// ===================================================================================
// HELPER FUNCTIONS (No changes needed here)
// ===================================================================================

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
 * Creates a new ChatTurn object with all relevant IDs updated for a new session.
 */
function generateDuplicateTurn(oldTurn: ChatTurn, newSessionId: string): ChatTurn {
	const { sequence } = oldTurn;
	const newChatTurnId = buildChatTurnId(newSessionId, sequence);
	const newRequestMessageId = buildMessageId(newSessionId, sequence, 'request');
	const newResponseMessageId = buildMessageId(newSessionId, sequence, 'response');

	return {
		...oldTurn,
		sessionId: newSessionId,
		chatTurnId: newChatTurnId,
		request: { ...oldTurn.request, sessionId: newSessionId, messageId: newRequestMessageId },
		response: { ...oldTurn.response, sessionId: newSessionId, messageId: newResponseMessageId },
	};
}
// ===================================================================================
// CORE LOGIC (Using the optimized store functions)
// ===================================================================================

async function duplicateChatSession(oldSessionId: string, newSessionId: string) {
	console.log(`🚀 Starting full duplication process...`);
	console.log(`   Source:      ${oldSessionId}`);
	console.log(`   Destination: ${newSessionId}`);

	try {
		// --- KEY CHANGE: This now calls the OPTIMIZED getAllChatTurns ---
		const { chatTurns } = await chatStore.getAllChatTurns(oldSessionId);

		if (!chatTurns || chatTurns.length === 0) {
			console.warn(`⚠️ No chat turns found for source session ID.`);
			return;
		}

		console.log(`   Found ${chatTurns.length} turns for a deep copy.`);
		const duplicatedTurns = chatTurns.map((turn) => generateDuplicateTurn(turn, newSessionId));
		const turnBatches = chunkArray(duplicatedTurns, BATCH_SIZE);

		console.log(`   📦 Processing in ${turnBatches.length} batches...`);
		for (let i = 0; i < turnBatches.length; i++) {
			const batch = turnBatches[i];
			console.log(`     -> Storing batch ${i + 1}/${turnBatches.length} (${batch.length} turns)...`);

			// --- KEY CHANGE: This now calls the CORRECTED storeChatTurns ---
			await chatStore.storeChatTurns(batch);
		}

		console.log(
			`✅ Success! Duplicated ${duplicatedTurns.length} turns to new session ${newSessionId}.`
		);
	} catch (error) {
		console.error(`💥 An error occurred during duplication:`, error);
	}
}

async function syncNewTurnsOnly(originalSessionId: string, duplicatedSessionId: string) {
	console.log(`🔄 Starting incremental sync...`);
	console.log(`   Source:      ${originalSessionId}`);
	console.log(`   Destination: ${duplicatedSessionId}`);

	try {
		// --- KEY CHANGE: Both calls are now to the OPTIMIZED getAllChatTurns ---
		const [originalResponse, duplicatedResponse] = await Promise.all([
			chatStore.getAllChatTurns(originalSessionId),
			chatStore.getAllChatTurns(duplicatedSessionId),
		]);

		const originalTurns = originalResponse.chatTurns || [];
		const lastSyncedSequence = (duplicatedResponse.chatTurns || []).reduce(
			(max, turn) => Math.max(max, turn.sequence),
			-1
		);

		console.log(`   Last synced sequence is ${lastSyncedSequence}.`);
		const newTurnsToSync = originalTurns.filter((turn) => turn.sequence > lastSyncedSequence);

		if (newTurnsToSync.length === 0) {
			console.log('✅ Destination is already up-to-date.');
			return;
		}

		console.log(`   Found ${newTurnsToSync.length} new turns to sync.`);
		const duplicatedNewTurns = newTurnsToSync.map((turn) =>
			generateDuplicateTurn(turn, duplicatedSessionId)
		);
		const turnBatches = chunkArray(duplicatedNewTurns, BATCH_SIZE);

		console.log(`   📦 Processing in ${turnBatches.length} batches...`);
		for (let i = 0; i < turnBatches.length; i++) {
			const batch = turnBatches[i];
			console.log(`     -> Storing batch ${i + 1}/${turnBatches.length} (${batch.length} turns)...`);

			// --- KEY CHANGE: This also uses the CORRECTED storeChatTurns ---
			await chatStore.storeChatTurns(batch);
		}

		console.log(`✅ Success! Synced ${newTurnsToSync.length} new turns to ${duplicatedSessionId}.`);
	} catch (error) {
		console.error(`💥 An error occurred during incremental sync:`, error);
	}
}

// ===================================================================================
// SCRIPT EXECUTION LOGIC
// ===================================================================================

/**
 * Main orchestrator function that decides whether to duplicate or sync.
 */
async function main() {
	const args = process.argv.slice(2);
	const sourceSessionId = args[0];
	const destinationSessionId = args[1]; // This will be undefined if only one arg is passed

	if (!sourceSessionId) {
		console.error('🚨 Please provide the source session ID.');
		console.error('\nUsage (Full Duplication):');
		console.error('  tsx ./scripts/chat/duplicateChat.ts <sourceSessionId>\n');
		console.error('Usage (Incremental Sync):');
		console.error('  tsx ./scripts/chat/duplicateChat.ts <sourceSessionId> <destinationSessionId>');
		process.exit(1);
	}

	if (destinationSessionId) {
		// --- SYNC MODE ---
		if (sourceSessionId === destinationSessionId) {
			console.error('❌ Error: Source and destination session IDs cannot be the same for a sync.');
			return;
		}
		await syncNewTurnsOnly(sourceSessionId, destinationSessionId);
	} else {
		// --- DUPLICATION MODE ---
		const newSessionId = buildSessionId(parseSessionId(sourceSessionId).characterId);
		await duplicateChatSession(sourceSessionId, newSessionId);
	}
}

main().catch((err) => {
	console.error('FATAL ERROR:', err);
	process.exit(1);
});
