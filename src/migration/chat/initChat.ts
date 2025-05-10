// Save this file as scripts/chat/initChat.ts (or your correct path)

import fs from 'node:fs/promises';
import path from 'node:path';
import { ChromaClient, Collection } from 'chromadb';
import { fileURLToPath } from 'node:url';

import { COLLECTIONS, METADATA_TYPES } from '../../shared/domain/chromadb/ChromaInterfaces.ts';
import { ChatMessage, ChatTurn, MigChatMessage } from '../../shared/domain/index.ts';
import { buildMessageId, buildSessionId, buildTurnId } from '../../server/util/buildIdUtils.ts';
import { isValidEmotionKeyword } from '../../shared/config/emotionWordsMapper.ts';
import { parseTextToEntries } from '../../shared/util/chatParseUtils.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configuration ---
const CHROMA_URL = process.env.CHROMA_API_URL || 'https://chromadb-flyio.fly.dev';
const CRAWLER_RESULT_DIR = path.join(__dirname, 'result');
const EMOTION_DEFAULT = 'default';

// --- ADJUST THESE FOR DEBUGGING ---
const UPSERT_BATCH_SIZE = 20; // Try a much smaller batch size, e.g., 20 or 10
const DELAY_BETWEEN_BATCHES_MS = 1000; // Increase delay to 1 second
// ---

// Helper function to upsert data in batches
async function upsertInBatches(
	collection: Collection,
	ids: string[],
	documents: string[],
	metadatas: Record<string, any>[],
	batchSize: number,
	sessionId: string
) {
	console.log(
		`    Starting batched upsert for session "${sessionId}". Total documents: ${ids.length}, Batch size: ${batchSize}`
	);
	for (let i = 0; i < ids.length; i += batchSize) {
		const batchNumber = Math.floor(i / batchSize) + 1;
		const batchEnd = Math.min(i + batchSize, ids.length);
		console.log(
			`      Preparing batch #${batchNumber} (indices ${i} to ${batchEnd - 1}) for session "${sessionId}"...`
		);

		const batchIds = ids.slice(i, batchEnd);
		const batchDocuments = documents.slice(i, batchEnd);
		const batchMetadatas = metadatas.slice(i, batchEnd);

		console.log(
			`      Attempting to upsert batch #${batchNumber} (size: ${batchIds.length}) for session "${sessionId}"...`
		);
		try {
			await collection.upsert({ ids: batchIds, documents: batchDocuments, metadatas: batchMetadatas });
			console.log(`      Successfully upserted batch #${batchNumber} for session "${sessionId}".`);
		} catch (batchError) {
			console.error(
				`      ERROR upserting batch #${batchNumber} for session "${sessionId}":`,
				batchError
			);
			console.error(
				`        Failed batch details - Size: ${batchIds.length}, First ID: ${batchIds[0]}`
			);
			throw batchError; // Re-throw to halt processing on batch failure
		}

		if (batchEnd < ids.length) {
			console.log(`      Waiting ${DELAY_BETWEEN_BATCHES_MS}ms before next batch...`);
			await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
		}
	}
	console.log(`    Finished batched upsert for session "${sessionId}".`);
}

// --- Main Seeding Logic ---
async function initChatFromLogFiles() {
	console.log(`Connecting to ChromaDB at: ${CHROMA_URL}`);
	const chroma = new ChromaClient({ path: CHROMA_URL });

	try {
		console.log(`Ensuring main collection "${COLLECTIONS.CHAT}" exists...`);
		const collection: Collection = await chroma.getOrCreateCollection({
			name: COLLECTIONS.CHAT,
			metadata: {
				description: 'Stores all chat session turns from crawled log files.',
				created_by_script: 'initChat.ts',
				type: COLLECTIONS.CHAT,
			},
		});
		console.log(`Collection "${COLLECTIONS.CHAT}" ready.`);

		const allLogFiles = (await fs.readdir(CRAWLER_RESULT_DIR)).filter((file) =>
			file.endsWith('.json')
		);

		if (allLogFiles.length === 0) {
			console.log(`No JSON log files found in ${CRAWLER_RESULT_DIR}. Nothing to process.`);
			return;
		}
		console.log(`Found the following log files to process: ${allLogFiles.join(', ')}`);

		// --- MODIFIED: Temporary skip for "monday" to focus on "tarion" or others ---
		// const logFilesToProcess = allLogFiles.filter((file) => !file.startsWith('tarion'));
		const logFilesToProcess = allLogFiles; // Uncomment this line to process all files normally
		// console.log(
		// 	`Files to actually process in this run: ${logFilesToProcess.join(', ') || 'None (if only monday_original was present)'}`
		// );
		// ---

		for (const logFile of logFilesToProcess) {
			// Changed from allLogFiles to logFilesToProcess
			const characterId = path.basename(logFile, '.json');
			const TARGET_SESSION_ID = buildSessionId(characterId);

			const filePath = path.join(CRAWLER_RESULT_DIR, logFile);
			console.log(`\nProcessing log file: "${logFile}" for session ID: "${TARGET_SESSION_ID}"...`);

			const fileContent = await fs.readFile(filePath, 'utf-8');
			const crawledLogs: MigChatMessage[] = JSON.parse(fileContent);

			if (!Array.isArray(crawledLogs) || crawledLogs.length === 0) {
				console.warn(`  No logs found or invalid format in "${logFile}". Skipping.`);
				continue;
			}

			const allTurnIdsForFile: string[] = [];
			const allTurnDocumentsForFile: string[] = [];
			const allTurnMetadatasForFile: Record<string, any>[] = [];

			const turnsMap = new Map<string, { user?: MigChatMessage; bot?: MigChatMessage }>();
			crawledLogs.forEach((log) => {
				const turnData = turnsMap.get(log.uuid) || {}; // Using log.uuid as the turn identifier
				if (log.role === 'user') {
					turnData.user = log;
				} else {
					turnData.bot = log;
				}
				turnsMap.set(log.uuid, turnData);
			});

			let sequence = 0;
			const sortedLogIds = Array.from(turnsMap.keys()).sort((a, b) => {
				const timeA = Date.parse(
					turnsMap.get(a)?.user?.timestamp || turnsMap.get(a)?.bot?.timestamp || ''
				);
				const timeB = Date.parse(
					turnsMap.get(b)?.user?.timestamp || turnsMap.get(b)?.bot?.timestamp || ''
				);
				return timeA - timeB;
			});

			for (const logId of sortedLogIds) {
				const turnPair = turnsMap.get(logId);

				if (turnPair?.user && turnPair?.bot) {
					const userLog = turnPair.user;
					const botLog = turnPair.bot;
					const requestTimestamp = userLog.timestamp;
					const responseTimestamp = botLog.timestamp;

					const requestMessage: ChatMessage = {
						role: 'user',
						messageId: buildMessageId(TARGET_SESSION_ID, sequence, 'request'),
						messageType: 'request',
						entries: parseTextToEntries(userLog.content),
						emotion: EMOTION_DEFAULT,
						timestamp: requestTimestamp,
						showName: '요니브',
						type: METADATA_TYPES.MESSAGE,
					};

					const responseMessage: ChatMessage = {
						role: 'assistant',
						messageId: buildMessageId(TARGET_SESSION_ID, sequence, 'response'),
						messageType: 'response',
						entries: parseTextToEntries(botLog.content),
						emotion:
							botLog.emotion && isValidEmotionKeyword(botLog.emotion) ? botLog.emotion : EMOTION_DEFAULT,
						timestamp: responseTimestamp,
						showName: '타리온',
						type: METADATA_TYPES.MESSAGE,
					};

					const chatTurn: ChatTurn = {
						sessionId: TARGET_SESSION_ID,
						sequence: sequence,
						request: requestMessage,
						response: responseMessage,
						chatTurnId: '',
						type: METADATA_TYPES.SET,
					};

					const turnId = buildTurnId(TARGET_SESSION_ID, sequence);
					const turnDocument = JSON.stringify(chatTurn);
					const turnMetadata = {
						type: METADATA_TYPES.SET,
						sessionId: TARGET_SESSION_ID,
						sequence,
						timestamp: requestTimestamp,
						model: botLog.model, // Renamed from modelUsed
						originalLogId: logId, // This is the log.uuid
					};

					allTurnIdsForFile.push(turnId);
					allTurnDocumentsForFile.push(turnDocument);
					allTurnMetadatasForFile.push(turnMetadata);
					sequence++;
				} else {
					console.warn(
						`  Incomplete turn data for log_id "${logId}" (uuid from log) in session "${TARGET_SESSION_ID}". User message found: ${!!turnPair?.user}, Bot message found: ${!!turnPair?.bot}. Skipping this turn.`
					);
				}
			}

			if (allTurnIdsForFile.length > 0) {
				console.log(
					`  Total ${allTurnIdsForFile.length} documents prepared for session "${TARGET_SESSION_ID}". UPSERT_BATCH_SIZE=${UPSERT_BATCH_SIZE}, DELAY_BETWEEN_BATCHES_MS=${DELAY_BETWEEN_BATCHES_MS}`
				);
				// Call the batch upsert function
				await upsertInBatches(
					collection,
					allTurnIdsForFile,
					allTurnDocumentsForFile,
					allTurnMetadatasForFile,
					UPSERT_BATCH_SIZE,
					TARGET_SESSION_ID
				);
				console.log(
					`  Successfully seeded all chat turns for session "${TARGET_SESSION_ID}" into collection "${COLLECTIONS.CHAT}".`
				);
			} else {
				console.log(
					`  No complete chat turns were processed to insert for session "${TARGET_SESSION_ID}".`
				);
			}
		}
	} catch (error) {
		console.error('Error seeding chat data from log files:', error);
		process.exit(1);
	}
}

initChatFromLogFiles();
