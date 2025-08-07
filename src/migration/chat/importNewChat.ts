import fs from 'node:fs';
import readline from 'node:readline';
import path from 'node:path';
import { ChatTurn } from '#shared/domain/chat/ChatInterfaces.js';
import { chatStore } from '#server/store/chatStore.js';
import { buildProfileId } from '#shared/util/buildIdUtils.js';
import { fileURLToPath } from 'node:url';

// --- NEW: Path Resolution Relative to This File ---
// Get the directory of the current script file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Define the backup directory as a subdirectory of the current script's location
const BACKUP_DIR = path.join(__dirname, 'backup');
// --- End New Logic ---// --- Configuration ---
const NEW_USER_ID = 'dbce0624-7eb1-4e0f-85d2-d25333996992'; // Your new production user ID

async function importTurnsFromJsonl() {
	// --- NEW: Get filename from command-line argument ---
	const filenameArg = process.argv[2];
	if (!filenameArg) {
		console.error('❌ ERROR: Please provide the filename (which is the session ID) as an argument.');
		console.error('Usage: pnpm your-script-name <session_id_filename>');
		process.exit(1);
	}

	// The session ID is the filename without the .jsonl extension
	const sessionId = path.basename(filenameArg, '.jsonl');
	const jsonlFilePath = path.join(BACKUP_DIR, `${sessionId}.jsonl`);

	console.log(`🚀 Starting import for session "${sessionId}" from: ${jsonlFilePath}`);

	if (!fs.existsSync(jsonlFilePath)) {
		console.error(`❌ ERROR: File not found at ${jsonlFilePath}`);
		process.exit(1);
	}

	console.log('Checking for the latest existing turn in the database...');
	const existingTurnsResponse = await chatStore.getAllDisplayTurns(sessionId);
	const latestSequenceInDB =
		existingTurnsResponse.displayTurns.length > 0
			? Math.max(...existingTurnsResponse.displayTurns.map((t) => t.sequence))
			: -1;

	console.log(
		`✅ Latest sequence in DB for this session is: ${latestSequenceInDB}. Importing turns after this.`
	);

	const turnsToImport: ChatTurn[] = [];
	const fileStream = fs.createReadStream(jsonlFilePath);
	const rl = readline.createInterface({
		input: fileStream,
		crlfDelay: Infinity,
	});

	for await (const line of rl) {
		if (line.trim() === '') continue;
		try {
			const originalTurn: ChatTurn = JSON.parse(line);
			if (originalTurn.sequence > latestSequenceInDB) {
				const modifiedTurn: ChatTurn = {
					...originalTurn,
					userId: NEW_USER_ID,
					profileId: buildProfileId(originalTurn.sessionId, NEW_USER_ID),
				};
				turnsToImport.push(modifiedTurn);
			}
		} catch (error) {
			console.error(`Skipping invalid line: ${line}`, error);
		}
	}

	if (turnsToImport.length === 0) {
		console.log('✅ No new turns to import. The database is already up-to-date.');
		return;
	}

	console.log(`Found ${turnsToImport.length} new turns to import. Storing them in the database...`);
	try {
		await chatStore.storeChatTurns(turnsToImport);
		console.log(`🎉 Successfully imported ${turnsToImport.length} new chat turns.`);
	} catch (error) {
		console.error('💥 An error occurred during the database import:', error);
	}
}

// --- Run the script ---
importTurnsFromJsonl().catch((error) => {
	console.error('🚨 A fatal error occurred:', error);
	process.exit(1);
});
