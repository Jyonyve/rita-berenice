// scripts/chat/deleteChatSession.ts

import { chatStore } from '#server/store/chatStore.js';
import { chromaDbClient } from '#server/db/chromaDbClient.js';

const BATCH_SIZE = 100; // Process deletions in batches for performance and stability

/**
 * A utility function to break a large array into smaller chunks.
 * @param arr The array to chunk.
 * @param size The size of each chunk.
 * @returns An array of smaller arrays (chunks).
 */
function chunkArray<T>(arr: T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < arr.length; i += size) {
		chunks.push(arr.slice(i, i + size));
	}
	return chunks;
}

/**
 * Deletes all chat turns and associated messages for a given session ID.
 * @param sessionId The ID of the session to completely remove.
 */
async function deleteChatSession(sessionId: string) {
	console.log(`🚀 Starting deletion process for session ID: ${sessionId}`);

	try {
		// 1. Fetch all turns for the session to identify what to delete.
		const { displayTurns: chatTurns } = await chatStore.getAllChatTurns(sessionId);

		if (!chatTurns || chatTurns.length === 0) {
			console.log(`✅ No chat turns found for session "${sessionId}". Nothing to delete.`);
			return;
		}

		console.log(`   🗑️ Found ${chatTurns.length} chat turns to delete.`);

		// 2. Collect all unique IDs to be deleted (both turns and their messages).
		const idsToDelete: string[] = [];
		chatTurns.forEach((turn) => {
			idsToDelete.push(turn.chatTurnId);
			idsToDelete.push(turn.requestMessageId);
			idsToDelete.push(turn.responseMessageId);
		});

		const uniqueIdsToDelete = [...new Set(idsToDelete)];
		console.log(`   Total unique records to delete: ${uniqueIdsToDelete.length}`);

		// 3. Perform a batched delete operation.
		const collection = await chatStore._getChatCollection();
		const idBatches = chunkArray(uniqueIdsToDelete, BATCH_SIZE);

		for (const [i, batch] of idBatches.entries()) {
			console.log(`      -> Deleting batch ${i + 1}/${idBatches.length} (${batch.length} records)...`);
			await chromaDbClient.deleteRecords(collection, batch);
		}

		console.log(`✅ Successfully deleted all data for session: ${sessionId}`);
	} catch (error) {
		console.error(`💥 An error occurred while deleting session ${sessionId}:`, error);
		process.exit(1);
	}
}

// --- Script Execution ---
const sessionIdToDelete = process.argv[2];

if (!sessionIdToDelete) {
	console.error('🚨 Please provide a sessionId as a command-line argument.');
	console.error('Usage: tsx ./scripts/chat/deleteChatSession.ts <sessionId>');
	process.exit(1);
}

deleteChatSession(sessionIdToDelete).catch((err) => {
	console.error('FATAL ERROR:', err);
	process.exit(1);
});
