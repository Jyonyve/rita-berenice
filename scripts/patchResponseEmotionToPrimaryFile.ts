// patchResponseEmotionToPrimaryFile.ts

/**
 * Reads a hardcoded ChatResponse JSON file,
 * replaces all response.emotion fields with characterEmotion.primary,
 * and writes the patched result to a new file.
 */

import fs from 'fs';
import path from 'path';
import { mockMondayChat } from '../src/client/mock/data/mockChatData';
import { fileURLToPath } from 'url';

// --- Adjust import path as needed ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Patcher
function patchResponseEmotionToPrimary(chatResponse: any): any {
	const patchedChatTurns = chatResponse.chatTurns.map((turn: any) => ({
		...turn,
		response: { ...turn.response, emotion: turn.characterEmotion.primary },
	}));
	return {
		...chatResponse,
		chatTurns: patchedChatTurns,
		chatTurn: patchedChatTurns[patchedChatTurns.length - 1] ?? chatResponse.chatTurn,
	};
}

// MAIN: Patch and write to file
const patched = patchResponseEmotionToPrimary(mockMondayChat);

const outputPath = path.resolve(__dirname, 'patchedChatResponse.json');
fs.writeFileSync(outputPath, JSON.stringify(patched, null, 2), 'utf-8');
console.log(`🎉 Patched file written to: ${outputPath}`);
