// scripts/chat/duplicateChat.ts

import { chatStore } from '#server/store/chatStore.js';
import { ChatTurn } from '#shared/domain/chat/ChatInterfaces.js';
import { parseSessionId } from '#shared/util/index.js';
import { buildChatTurnId, buildMessageId, buildSessionId } from '#shared/util/buildIdUtils.js';

const BATCH_SIZE = 100; // Process 100 turns per batch to stay safely under the token limit

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
 * Creates a new ChatTurn object with all relevant IDs updated for a new session.
 * @param oldTurn The original ChatTurn object.
 * @param newSessionId The new session ID to assign.
 * @returns A new ChatTurn object ready for insertion.
 */
function generateDuplicateTurn(oldTurn: ChatTurn, newSessionId: string): ChatTurn {
	const { sequence } = oldTurn;

	const newChatTurnId = buildChatTurnId(newSessionId, sequence);
	const newRequestMessageId = buildMessageId(newSessionId, sequence, 'request');
	const newResponseMessageId = buildMessageId(newSessionId, sequence, 'response');

	const newTurn: ChatTurn = {
		...oldTurn,
		sessionId: newSessionId,
		chatTurnId: newChatTurnId,
		request: { ...oldTurn.request, sessionId: newSessionId, messageId: newRequestMessageId },
		response: { ...oldTurn.response, sessionId: newSessionId, messageId: newResponseMessageId },
	};

	return newTurn;
}

/**
 * Fetches all chat turns from an existing session and duplicates them
 * into a new session using a batched approach to avoid API limits.
 * @param oldSessionId The source session ID to copy from.
 * @param newSessionId The destination session ID to copy to.
 */
async function duplicateChatSession(oldSessionId: string, newSessionId: string) {
	console.log(`🚀 Starting duplication process...`);
	console.log(`   Source Session ID: ${oldSessionId}`);
	console.log(`   Destination Session ID: ${newSessionId}`);

	if (oldSessionId === newSessionId) {
		console.error('❌ Error: Source and destination session IDs cannot be the same.');
		return;
	}

	try {
		const { chatTurns } = await chatStore.getAllChatTurns(oldSessionId);
		if (!chatTurns || chatTurns.length === 0) {
			console.warn(`⚠️ No chat turns found for source session ID: ${oldSessionId}.`);
			return;
		}
		console.log(`   Found ${chatTurns.length} turns to duplicate.`);

		const duplicatedTurns = chatTurns.map((turn) => generateDuplicateTurn(turn, newSessionId));

		// ✅ FIX: Process the turns in batches.
		const turnBatches = chunkArray(duplicatedTurns, BATCH_SIZE);
		console.log(
			`   📦 Processing ${duplicatedTurns.length} turns in ${turnBatches.length} batches of up to ${BATCH_SIZE}.`
		);

		for (let i = 0; i < turnBatches.length; i++) {
			const batch = turnBatches[i];
			console.log(`      -> Storing batch ${i + 1}/${turnBatches.length} (${batch.length} turns)...`);
			await chatStore.storeChatTurns(batch);
		}

		console.log(
			`✅ Success! Duplicated ${duplicatedTurns.length} turns from ${oldSessionId} to ${newSessionId}.`
		);
	} catch (error) {
		console.error(`💥 An error occurred during the duplication process:`, error);
	}
}

// --- Script Execution ---
const oldSessionId = process.argv[2];
const newSessionId = buildSessionId(parseSessionId(oldSessionId).characterId);

if (!oldSessionId || !newSessionId) {
	console.error('🚨 Please provide both the old and new session IDs as arguments.');
	console.error('Usage: tsx ./scripts/chat/duplicateChat.ts <oldSessionId> <newSessionId>');
	process.exit(1);
}

duplicateChatSession(oldSessionId, newSessionId).catch((err) => {
	console.error('FATAL ERROR:', err);
	process.exit(1);
});
