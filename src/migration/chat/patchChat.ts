// patchChatResponseEmotionInDB.ts

import path from 'path';
import { fileURLToPath } from 'url';
import { chatStore } from '#server/store/chatStore.js';
import { ChatResponse } from '#shared/api/ModuleResponse.js';
import { ChatTurn } from '#shared/domain/chat/ChatInterfaces.js';
import { buildChatTurnId, buildMessageId } from '#shared/util/buildIdUtils.js';
import { flatChatTurnToDoc } from '#server/util/documentUtils.js';
import { chatTurnToMetadata } from '#shared/util/dbConvertUtils.js';

// ESM-compatible path retrieval
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BATCH_SIZE = 20;
const tarion_original = 'tarion_original_ueDVsINn';
const tarion_spinoff = 'tarion_spinoff_sw1MLtIj';

function chunkArray<T>(arr: T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < arr.length; i += size) {
		chunks.push(arr.slice(i, i + size));
	}
	return chunks;
}

// Generate new IDs based on the new sessionId (8-char nanoID)
function generateUpdatedIds(oldTurn: ChatTurn, newSessionId: string): ChatTurn {
	// Extract sequence and other parts from existing IDs
	const sequence = oldTurn.sequence;

	// Generate new IDs with updated sessionId
	const newChatTurnId = buildChatTurnId(newSessionId, sequence);
	const newRequestMessageId = buildMessageId(newSessionId, sequence, 'request');
	const newResponseMessageId = buildMessageId(newSessionId, sequence, 'response');
	console.log(`generateUpdatedIds: ${newChatTurnId}`);
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
			emotion: oldTurn.userEmotion.primary, // Update request emotion
		},
		response: {
			...oldTurn.response,
			sessionId: newSessionId,
			messageId: newResponseMessageId,
			emotion: oldTurn.characterEmotion.primary,
		},
	};
}

// Enhanced patch utility for both request and response emotions
function patchChatResponseEmotions(
	chatResponse: ChatResponse,
	newSessionId?: string
): ChatResponse {
	const patchedChatTurns = chatResponse.chatTurns.map((turn) => {
		let updatedTurn = {
			...turn,
			request: { ...turn.request, emotion: turn.userEmotion.primary },
			response: { ...turn.response, emotion: turn.characterEmotion.primary },
		};

		// If new sessionId provided, update all related IDs
		if (newSessionId && newSessionId !== turn.sessionId) {
			updatedTurn = generateUpdatedIds(updatedTurn, newSessionId);
		}

		return updatedTurn;
	});

	return {
		...chatResponse,
		chatTurns: patchedChatTurns,
		chatTurn: patchedChatTurns[patchedChatTurns.length - 1] ?? chatResponse.chatTurn,
	};
}

// --- Batch Upsert Implementation ---
const batchUpsertChatTurns = async (chatTurns: ChatTurn[]) => {
	const collection = await chatStore._getChatCollection(); // direct ChromaDB collection
	const batches = chunkArray(chatTurns, BATCH_SIZE);

	for (const batch of batches) {
		const ids = batch.map((turn) => turn.chatTurnId);
		const documents = batch.map((turn) => flatChatTurnToDoc(turn));
		const metadatas = batch.map((turn) => chatTurnToMetadata(turn)) as any;
		console.log(ids);

		await collection.upsert({ ids, documents, metadatas });
	}
};
const upsertChatSessionWithNewId = async (oldSessionId: string, newSessionId: string) => {
	console.log(`🔄 Migrating session from ${oldSessionId} to ${newSessionId}`);

	try {
		// 1. Fetch all turns by oldSessionId
		const chatResponse = await chatStore.getAllChatTurns(oldSessionId);
		if (!chatResponse || !chatResponse.chatTurns?.length) {
			console.error(`❌ No chat turns found for session ID: ${oldSessionId}`);
			return;
		}

		// 2. Patch emotions and new IDs
		const patchedTurns = patchChatResponseEmotions(chatResponse, newSessionId).chatTurns;

		// 3. Batch upsert new turns
		console.log(`📦 Batch upserting ${patchedTurns.length} turns with new sessionId...`);
		await batchUpsertChatTurns(patchedTurns);

		// 4. Batch delete old turns
		console.log('lets delete');
		const collection = await chatStore._getChatCollection();
		const oldIds = chatResponse.chatTurns.map((t) => t.chatTurnId);
		for (const batch of chunkArray(oldIds, BATCH_SIZE)) {
			console.log(batch);
			await collection.delete({ ids: batch });
		}

		console.log(`✅ Batch migration complete for session ${oldSessionId} -> ${newSessionId}`);
	} catch (error) {
		console.error(`❌ Migration failed for ${oldSessionId} -> ${newSessionId}:`, error);
		throw error;
	}
};

const patchChatSessionEmotions = async (sessionId: string, newSessionId?: string) => {
	if (newSessionId) {
		await upsertChatSessionWithNewId(sessionId, newSessionId);
	} else {
		// Patch emotions only (no session id change)
		const chatResponse = await chatStore.getAllChatTurns(sessionId);
		if (!chatResponse || !chatResponse.chatTurns?.length) {
			console.error(`❌ No chat turns found for session ID: ${sessionId}`);
			return;
		}
		const patched = patchChatResponseEmotions(chatResponse).chatTurns;
		await batchUpsertChatTurns(patched);
		console.log(
			`🎉 Success! All request and response emotions batch updated for session: ${sessionId}`
		);
	}
};

// --- Script usage examples ---
const run = async () => {
	// Example 1: Update emotions only
	// await patchChatSessionEmotions('monday_original_zUwPMBc4');

	// Example 2: Migrate sessionId (16-char to 8-char) + update emotions
	const oldSessionId = 'tarion_original_fhTob3vkzxHF6tJc'; // 16-char nanoID
	const newSessionId = tarion_original; // 8-char nanoID
	await patchChatSessionEmotions(oldSessionId, newSessionId);
};

// Export for use in other scripts
export { patchChatSessionEmotions, upsertChatSessionWithNewId };

run();
