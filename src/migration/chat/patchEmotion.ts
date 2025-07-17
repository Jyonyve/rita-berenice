// patchChatResponseEmotionInDB.ts

import path from 'path';
import { fileURLToPath } from 'url';
import { chatStore } from '#server/store/chatStore.js';
import { ChatResponse } from '#shared/api/ModuleResponse.js';

// ESM-compatible path retrieval
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Patch utility from above
function patchChatResponseResponseEmotion(chatResponse: ChatResponse): ChatResponse {
	const patchedChatTurns = chatResponse.chatTurns.map((turn) => ({
		...turn,
		response: { ...turn.response, emotion: turn.characterEmotion.primary },
	}));
	return {
		...chatResponse,
		chatTurns: patchedChatTurns,
		chatTurn: patchedChatTurns[patchedChatTurns.length - 1] ?? chatResponse.chatTurn,
	};
}

// Main function to fetch, patch, and update
const patchChatSessionEmotions = async (sessionId: string) => {
	console.log(`🚀 Patching response.emotion for chat session: ${sessionId}`);

	// Fetch chat turns from DB
	const chatResponse = await chatStore.getAllChatTurns(sessionId);
	if (!chatResponse || !chatResponse.chatTurns?.length) {
		console.error(`❌ No chat turns found for session ID: ${sessionId}`);
		return;
	}

	// Patch emotions
	const patched = patchChatResponseResponseEmotion(chatResponse);

	// Overwrite each chat turn in the DB (one by one)
	for (const turn of patched.chatTurns) {
		await chatStore.storeChatTurn(turn);
		// Your chatStore must have updateChatTurnEmotion or similar method;
		// else, use an existing update method with full turn object.
	}

	console.log(`🎉 Success! All response.emotion fields updated for session: ${sessionId}`);
};

// --- Script usage example ---
const run = async () => {
	const sessionId = 'monday_original_zUwPMBc4'; // replace with actual sessionId
	await patchChatSessionEmotions(sessionId);
};

run();
