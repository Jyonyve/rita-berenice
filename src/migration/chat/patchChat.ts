// patchChatResponseEmotionInDB.ts

import path from 'path';
import { fileURLToPath } from 'url';
import { chatStore } from '#server/store/chatStore.js';
import { ChatResponse } from '#shared/api/ModuleResponse.js';
import { ChatTurn } from '#shared/domain/chat/ChatInterfaces.js';
import { buildChatTurnId, buildMessageId } from '#shared/util/buildIdUtils.js';
import { chatTurnToDocument } from '#shared/src/shared/util/documentUtils.js';
import { chatTurnToMetadata } from '#shared/util/dbConvertUtils.js';
import { Metadata } from 'chromadb';

// Configuration
const BATCH_SIZE = 50; // A safe batch size to avoid token limits

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
function generateUpdatedIds(oldTurn: ChatTurn, newSessionId: string): ChatTurn {
	const { sequence } = oldTurn;

	const newChatTurnId = buildChatTurnId(newSessionId, sequence);
	const newRequestMessageId = buildMessageId(newSessionId, sequence, 'request');
	const newResponseMessageId = buildMessageId(newSessionId, sequence, 'response');

	return {
		...oldTurn,
		sessionId: newSessionId,
		chatTurnId: newChatTurnId,
		requestMessageId: newRequestMessageId,
		responseMessageId: newResponseMessageId,
		request: {
			...oldTurn.request,
			sessionId: newSessionId,
			messageId: newRequestMessageId,
			emotion: oldTurn.userEmotion.primary,
		},
		response: {
			...oldTurn.response,
			sessionId: newSessionId,
			messageId: newResponseMessageId,
			emotion: oldTurn.characterEmotion.primary,
		},
	};
}

/**
 * Applies emotion patches and optionally new session IDs to a set of chat turns.
 * @param chatResponse The original ChatResponse object.
 * @param newSessionId An optional new session ID for migration.
 * @returns A new ChatResponse with the updated turns.
 */
function patchChatTurns(chatResponse: ChatResponse, newSessionId?: string): ChatResponse {
	const patchedChatTurns = chatResponse.displayTurns.map((turn) => {
		let updatedTurn = {
			...turn,
			request: { ...turn.request, emotion: turn.userEmotion.primary },
			response: { ...turn.response, emotion: turn.characterEmotion.primary },
		};

		if (newSessionId && newSessionId !== turn.sessionId) {
			updatedTurn = generateUpdatedIds(updatedTurn, newSessionId);
		}

		return updatedTurn;
	});

	return {
		...chatResponse,
		displayTurns: patchedChatTurns,
		displayTurn: patchedChatTurns[patchedChatTurns.length - 1] ?? chatResponse.displayTurn,
	};
}

/**
 * Performs a batched upsert operation for an array of chat turns.
 * @param chatTurns The array of ChatTurn objects to upsert.
 */
const batchUpsertChatTurns = async (chatTurns: ChatTurn[]) => {
	const batches = chunkArray(chatTurns, BATCH_SIZE);

	for (const [i, batch] of batches.entries()) {
		console.log(`   -> Upserting batch ${i + 1}/${batches.length} (${batch.length} turns)...`);
		await chatStore.storeChatTurns(batch);
	}
};

/**
 * Migrates an entire chat session to a new session ID.
 * @param oldSessionId The source session ID.
 * @param newSessionId The destination session ID.
 */
const migrateSession = async (oldSessionId: string, newSessionId: string) => {
	console.log(`🔄 Migrating session from ${oldSessionId} to ${newSessionId}...`);
	try {
		const chatResponse = await chatStore.getAllChatTurns(oldSessionId);
		if (!chatResponse || !chatResponse.displayTurns?.length) {
			console.error(`❌ No chat turns found for session ID: ${oldSessionId}`);
			return;
		}
		console.log(`   Found ${chatResponse.displayTurns.length} turns to migrate.`);

		const patchedTurns = patchChatTurns(chatResponse, newSessionId).displayTurns;

		console.log(`   📦 Batch upserting turns to new session...`);
		await batchUpsertChatTurns(patchedTurns);

		console.log(`   🗑️ Batch deleting old turns...`);
		const collection = await chatStore._getChatCollection();
		const oldIds = chatResponse.displayTurns.map((t) => t.chatTurnId);
		const idBatches = chunkArray(oldIds, BATCH_SIZE);

		for (const [i, batch] of idBatches.entries()) {
			console.log(`      -> Deleting batch ${i + 1}/${idBatches.length}...`);
			await collection.delete({ ids: batch });
		}

		console.log(`✅ Migration complete: ${oldSessionId} -> ${newSessionId}`);
	} catch (error) {
		console.error(`❌ Migration failed for ${oldSessionId} -> ${newSessionId}:`, error);
	}
};

/**
 * Patches the emotions for all turns in a session without changing the session ID.
 * @param sessionId The ID of the session to patch.
 */
const patchEmotionsInPlace = async (sessionId: string) => {
	console.log(`🎨 Patching emotions for session: ${sessionId}...`);
	try {
		const chatResponse = await chatStore.getAllChatTurns(sessionId);
		if (!chatResponse || !chatResponse.displayTurns?.length) {
			console.error(`❌ No chat turns found for session ID: ${sessionId}`);
			return;
		}
		console.log(`   Found ${chatResponse.displayTurns.length} turns to patch.`);

		const patchedTurns = patchChatTurns(chatResponse).displayTurns;
		await batchUpsertChatTurns(patchedTurns);
		console.log(`🎉 Success! All emotions updated for session: ${sessionId}`);
	} catch (error) {
		console.error(`❌ Emotion patching failed for ${sessionId}:`, error);
	}
};

// --- Main Script Execution ---
const run = async () => {
	const oldSessionId = process.argv[2];
	const newSessionId = process.argv[3]; // Will be undefined if only one argument is provided

	if (!oldSessionId) {
		console.error('🚨 Please provide the required session ID(s).');
		console.error('\nUsage for patching emotions in-place:');
		console.error('npx tsx ./path/to/script.ts <sessionId>\n');
		console.error('Usage for migrating to a new session ID:');
		console.error('npx tsx ./path/to/script.ts <oldSessionId> <newSessionId>');
		process.exit(1);
	}

	if (newSessionId) {
		// --- Mode 1: Migrate Session ---
		await migrateSession(oldSessionId, newSessionId);
	} else {
		// --- Mode 2: Patch Emotions Only ---
		await patchEmotionsInPlace(oldSessionId);
	}
};

run().catch((err) => {
	console.error('💥 FATAL SCRIPT ERROR:', err);
	process.exit(1);
});
