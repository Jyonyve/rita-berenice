import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chatStore, characterStore, profileStore, sessionStore } from '../../server/store/index.js';

// ESM-compatible way to get the current directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generates mock data for chat sessions.
 */
const generateMockChatData = async (sessionId: string) => {
	console.log(`🚀 Starting MOCK-CHAT generation for session: ${sessionId}`);
	try {
		const response = await chatStore.getAllChatTurns(sessionId);
		if (!response || response.ids.length === 0) {
			console.error(`❌ No chat turns found for session ID: ${sessionId}`);
			return;
		}

		const outputPath = path.resolve(__dirname, '../mock/data/mockChatResponse.json');
		const outputDir = path.dirname(outputPath);
		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
		}
		fs.writeFileSync(outputPath, JSON.stringify(response, null, 2), 'utf-8');
		console.log(`\n🎉 Success! Mock chat data created at: ${outputPath}`);
	} catch (error) {
		console.error('\n🔥 An error occurred during chat mock generation:', error);
	}
};

/**
 * Generates mock data for profile.
 */
const generateMockCharacterData = async (characterId: string) => {
	console.log(`🚀 Starting MOCK-CHARACTER generation for show: ${characterId}`);
	try {
		const response = await characterStore.getCharacter(characterId);
		if (!response || response.ids.length === 0) {
			console.error(`❌ No characters found for show name: ${characterId}`);
			return;
		}

		const outputPath = path.resolve(__dirname, '../mock/data/mockCharacterResponse.json');
		const outputDir = path.dirname(outputPath);
		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
		}
		fs.writeFileSync(outputPath, JSON.stringify(response, null, 2), 'utf-8');
		console.log(`\n🎉 Success! Mock character data created at: ${outputPath}`);
	} catch (error) {
		console.error('\n🔥 An error occurred during character mock generation:', error);
	}
};

/**
 * Generates mock data for profile.
 */
const generateMockProfileData = async (sessionId: string) => {
	console.log(`🚀 Starting MOCK-profile generation for show: ${sessionId}`);
	try {
		const response = await profileStore.getProfileBySessionId(sessionId);
		if (!response || response.ids.length === 0) {
			console.error(`❌ No characters found for show name: ${sessionId}`);
			return;
		}

		const outputPath = path.resolve(__dirname, '../mock/data/mockProfileResponse.json');
		const outputDir = path.dirname(outputPath);
		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
		}
		fs.writeFileSync(outputPath, JSON.stringify(response, null, 2), 'utf-8');
		console.log(`\n🎉 Success! Mock profile data created at: ${outputPath}`);
	} catch (error) {
		console.error('\n🔥 An error occurred during character mock generation:', error);
	}
};

/**
 * Generates mock data for profile.
 */
const generateMockSessionData = async (userId: string, characterId: string) => {
	console.log(`🚀 Starting MOCK-Session generation`);
	try {
		const response = await sessionStore.getSessionsByUserIdAndCharacterId(userId, characterId);
		if (!response || response.ids.length === 0) {
			console.error(`❌ No Session found for show name: ${characterId}`);
			return;
		}

		const outputPath = path.resolve(__dirname, '../mock/data/mockSessionResponse.json');
		const outputDir = path.dirname(outputPath);
		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
		}
		fs.writeFileSync(outputPath, JSON.stringify(response, null, 2), 'utf-8');
		console.log(`\n🎉 Success! Mock character data created at: ${outputPath}`);
	} catch (error) {
		console.error('\n🔥 An error occurred during character mock generation:', error);
	}
};

// --- Script Execution Logic ---
const run = async () => {
	const command: string = 'profile';

	const characterId = 'monday_original';
	const sessionId = 'monday_original_zUwPMBc4';
	const userId = '6b335673-c837-43f9-a1c7-0b92c90edefb';

	switch (command) {
		case 'chat':
			await generateMockChatData(sessionId);
			break;
		case 'character':
			await generateMockCharacterData(characterId);
			break;
		case 'profile':
			await generateMockProfileData(sessionId);
			break;
		case 'session':
			await generateMockSessionData(userId, characterId);
			break;
		default:
			console.error(`Unknown command: ${command}`);
			console.log('Available commands: "chat", "character", "profile", "session"');
			process.exit(1);
	}
};

run();
