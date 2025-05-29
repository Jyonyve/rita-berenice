// scripts/chat/initChat.ts

import fs from 'node:fs/promises';
import path from 'node:path';
import { ChromaClient, Collection } from 'chromadb';
import { fileURLToPath } from 'node:url';
import { ChatMessage, ChatTurn, MigChatMessage } from '#shared/domain/chat/ChatInterfaces.ts';
import { buildChatTurnMetadataPrompt } from '#root/src/server/util/templateUtils.ts';
import {
	convertArrayToString,
	parseChatTurnToMetadata,
	parseTextToEntries,
} from '#root/src/shared/util/chatParseUtils.ts';
import { buildChatTurnDocument } from '#root/src/server/util/documentUtils.ts';
import { COLLECTIONS, METADATA_TYPES } from '#root/src/shared/domain/chromadb/ChromaInterfaces.ts';
import {
	buildCharacterId,
	buildChatTurnId,
	buildMessageId,
	buildSessionId,
} from '#root/src/server/util/buildIdUtils.ts';
import { validEmotions } from '#root/src/shared/config/emotionWordsMapper.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configuration ---
const CHROMA_URL = process.env.CHROMA_API_URL || 'https://chromadb-flyio.fly.dev';
const CRAWLER_RESULT_DIR = path.join(__dirname, 'result');
const EMOTION_DEFAULT = 'default';

// LLM Configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyDcw_sDLQSjD0fJARHJNaRoIZv_Se6YGj8';
const ENRICHMENT_MODEL = 'gemini-2.0-flash-001'; // Fast model for metadata extraction

// --- ADJUST THESE FOR DEBUGGING ---
const UPSERT_BATCH_SIZE = 10; // Smaller batch size for enriched turns
const DELAY_BETWEEN_BATCHES_MS = 2000; // Longer delay due to LLM calls
const DELAY_BETWEEN_LLM_CALLS_MS = 1000; // Delay between individual LLM calls
// ---

// ✅ Add Progress Tracking Configuration
const PROGRESS_DIR = path.join(__dirname, 'progress');
const PROGRESS_FILE_PREFIX = 'initchat-progress';

// ✅ Add Progress Interface
interface InitChatProgress {
	sessionId: string;
	totalTurns: number;
	processedTurns: number;
	lastProcessedSequence: number;
	startedAt: string;
	lastUpdated: string;
	status: 'in_progress' | 'completed' | 'failed';
	errors: string[];
}

// ✅ Add Progress Helper Functions
const getProgressFilePath = (sessionId: string): string => {
	return path.join(PROGRESS_DIR, `${PROGRESS_FILE_PREFIX}-${sessionId}.json`);
};

const loadInitProgress = async (sessionId: string): Promise<InitChatProgress | null> => {
	try {
		await fs.mkdir(PROGRESS_DIR, { recursive: true });
		const progressFile = getProgressFilePath(sessionId);
		const data = await fs.readFile(progressFile, 'utf-8');
		return JSON.parse(data);
	} catch {
		return null;
	}
};

const saveInitProgress = async (progress: InitChatProgress): Promise<void> => {
	try {
		await fs.mkdir(PROGRESS_DIR, { recursive: true });
		const progressFile = getProgressFilePath(progress.sessionId);
		await fs.writeFile(progressFile, JSON.stringify(progress, null, 2));
	} catch (error) {
		console.error('Failed to save progress:', error);
	}
};

const createInitialProgress = (sessionId: string, totalTurns: number): InitChatProgress => {
	return {
		sessionId,
		totalTurns,
		processedTurns: 0,
		lastProcessedSequence: -1,
		startedAt: new Date().toISOString(),
		lastUpdated: new Date().toISOString(),
		status: 'in_progress',
		errors: [],
	};
};

const extractJsonFromMarkdown = (response: string): any => {
	let cleaned = response.trim();

	try {
		// Method 1: Remove code blocks with proper escaping
		cleaned = cleaned.replace(/``````/gi, (match) => {
			// Extract content between ``````
			return match.replace(/^``````$/i, '');
		});

		// Method 2: Remove any remaining code blocks
		cleaned = cleaned.replace(/``````/g, '$1');

		// Method 3: Remove standalone backticks
		cleaned = cleaned.replace(/`/g, '');

		// Trim and find JSON
		cleaned = cleaned.trim();

		// Extract JSON object
		const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			return JSON.parse(jsonMatch[0]);
		}

		return JSON.parse(cleaned);
	} catch (error) {
		console.error('JSON extraction failed:', error);
		console.error('Cleaned text was:', cleaned);
		return {};
	}
};

// --- LLM Functions ---
const generateEnrichedMetadata = async (prompt: string): Promise<string> => {
	if (!GEMINI_API_KEY) {
		throw new Error('GEMINI_API_KEY environment variable is required');
	}

	try {
		const response = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/${ENRICHMENT_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					contents: [{ parts: [{ text: prompt }] }],
					generationConfig: {
						temperature: 0.3, // Lower temperature for consistent metadata
						maxOutputTokens: 1024, // Enough for JSON metadata
					},
				}),
			}
		);

		if (!response.ok) {
			if (response.status === 429) {
				const retryAfter = response.headers.get('retry-after');
				const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
				console.log(`⏳ Gemini rate limited. Waiting ${waitTime}ms before retry...`);
				await new Promise((resolve) => setTimeout(resolve, waitTime));
				return generateEnrichedMetadata(prompt); // Retry
			}
			throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
		}

		const data = await response.json();
		const content = data.candidates[0]?.content?.parts[0]?.text || '';

		if (!content) {
			throw new Error('Empty response from Gemini API');
		}

		return content;
	} catch (error) {
		console.error('Error calling Gemini API for metadata enrichment:', error);
		throw error;
	}
};

const enrichChatTurnWithMetadata = async (
	turn: ChatTurn,
	existingLoreIds: string[] = [],
	existingHistoryIds: string[] = []
): Promise<ChatTurn> => {
	try {
		console.log(`    🧠 Enriching turn ${turn.sequence} with LLM metadata...`);

		// Get character info from turn
		const userName = turn.request.showName;
		const charName = turn.response.showName;
		const userGender = 'female'; // You can derive this from profile if available
		const charGender = 'male'; // Adjust as needed

		const prompt = buildChatTurnMetadataPrompt(
			userName,
			userGender,
			turn.request,
			charName,
			charGender,
			turn.response,
			existingLoreIds,
			existingHistoryIds
		);
		const llmResponse = await generateEnrichedMetadata(prompt);

		// Parse LLM JSON response
		let enrichedMetadata: any;
		try {
			enrichedMetadata = extractJsonFromMarkdown(llmResponse);
		} catch (parseError) {
			console.warn(`    ⚠️ Failed to parse LLM metadata for turn ${turn.sequence}:`, parseError);
			enrichedMetadata = {};
		}

		// Create enriched ChatTurn with RICH OBJECTS (not flattened)
		const enrichedTurn: ChatTurn = {
			...turn,
			// Add enriched metadata fields (rich object structure for ChatTurn)
			summary: enrichedMetadata.summary || 'N/A',
			keywords: enrichedMetadata.keywords || [],
			topics: enrichedMetadata.topics || [],
			entities: enrichedMetadata.entities || [],

			// Keep emotion objects as rich structures for ChatTurn interface
			userEmotion: {
				primary: enrichedMetadata.userEmotion?.primary || 'neutral',
				intensity: enrichedMetadata.userEmotion?.intensity || 0.5,
				nuances: enrichedMetadata.userEmotion?.nuances || [],
			},
			characterEmotion: {
				primary: enrichedMetadata.characterEmotion?.primary || 'neutral',
				intensity: enrichedMetadata.characterEmotion?.intensity || 0.5,
				nuances: enrichedMetadata.characterEmotion?.nuances || [],
			},

			relationshipShifts: enrichedMetadata.relationshipShifts || [],
			dialogueAct: enrichedMetadata.dialogueAct || 'N/A',
			actions: enrichedMetadata.actions || [],
			loreReferences: enrichedMetadata.loreReferences || [],
			historyReferences: enrichedMetadata.historyReferences || [],
			flags: enrichedMetadata.flags || [],
			memoryChunk: enrichedMetadata.memoryChunk || 'N/A',

			// Add required base metadata fields
			characterId: turn.sessionId.split('_')[0],
			updatedAt: new Date().toISOString(),
		};

		console.log(`    ✅ Turn ${turn.sequence} enriched successfully`);
		return enrichedTurn;
	} catch (error) {
		console.error(`    ❌ Error enriching turn ${turn.sequence}:`, error);
		// Return original turn with default enriched metadata (rich objects)
		return {
			...turn,
			...getDefaultEnrichedMetadata(), // Now returns rich objects
			characterId: turn.sessionId.split('_')[0],
			updatedAt: new Date().toISOString(),
		};
	}
};

// In your initChat.ts, update getDefaultEnrichedMetadata to return rich objects:

const getDefaultEnrichedMetadata = () => ({
	summary: 'N/A',
	keywords: [], // Array for ChatTurn interface
	topics: [], // Array for ChatTurn interface
	entities: [], // Array for ChatTurn interface
	// Rich emotion objects (not flattened)
	userEmotion: { primary: 'neutral', intensity: 0.5, nuances: [] },
	characterEmotion: { primary: 'neutral', intensity: 0.5, nuances: [] },
	relationshipShifts: [], // Array for ChatTurn interface
	dialogueAct: 'N/A',
	actions: [], // Array for ChatTurn interface
	loreReferences: [], // Array of objects for ChatTurn interface
	historyReferences: [], // Array of objects for ChatTurn interface
	flags: [], // Array for ChatTurn interface
	memoryChunk: 'N/A',
});

// Helper function to upsert enriched data in batches
// Updated upsertEnrichedInBatches function with progressive saving and helper usage

async function upsertEnrichedInBatchesWithProgress(
	collection: Collection,
	turns: ChatTurn[],
	batchSize: number,
	sessionId: string,
	progress: InitChatProgress
) {
	console.log(
		`Starting enriched processing for session "${sessionId}". Remaining turns: ${turns.length}`
	);

	for (let i = 0; i < turns.length; i++) {
		const turn = turns[i];
		const globalIndex = progress.processedTurns + i;

		try {
			console.log(
				`    🧠 Processing turn ${turn.sequence} (${globalIndex + 1}/${progress.totalTurns})...`
			);

			// Enrich with LLM
			const enrichedTurn = await enrichChatTurnWithMetadata(turn);

			// Use helper function to convert to ChromaDB metadata
			const turnMetadata = parseChatTurnToMetadata(enrichedTurn);
			const turnDocument = buildChatTurnDocument(enrichedTurn);

			// Save individual turn immediately
			await collection.upsert({
				ids: [enrichedTurn.chatTurnId],
				documents: [turnDocument],
				metadatas: [turnMetadata],
			});

			// ✅ Update progress after successful save
			progress.processedTurns = globalIndex + 1;
			progress.lastProcessedSequence = turn.sequence;
			progress.lastUpdated = new Date().toISOString();
			await saveInitProgress(progress);

			console.log(
				`    ✅ Turn ${turn.sequence} enriched and saved (${progress.processedTurns}/${progress.totalTurns})`
			);

			// Delay between LLM calls
			if (i < turns.length - 1) {
				await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_LLM_CALLS_MS));
			}
		} catch (error) {
			console.error(`    ❌ Error processing turn ${turn.sequence}:`, error);

			// ✅ Record error in progress
			progress.errors.push(
				`Turn ${turn.sequence}: ${error instanceof Error ? error.message : String(error)}`
			);
			await saveInitProgress(progress);

			// Save with default metadata
			try {
				const fallbackTurn = {
					...turn,
					...getDefaultEnrichedMetadata(),
					characterId: turn.sessionId.split('_')[0],
					updatedAt: new Date().toISOString(),
				};

				const fallbackMetadata = parseChatTurnToMetadata(fallbackTurn);
				const fallbackDocument = buildChatTurnDocument(fallbackTurn);

				await collection.upsert({
					ids: [fallbackTurn.chatTurnId],
					documents: [fallbackDocument],
					metadatas: [fallbackMetadata],
				});

				// ✅ Update progress even for fallback
				progress.processedTurns = globalIndex + 1;
				progress.lastProcessedSequence = turn.sequence;
				progress.lastUpdated = new Date().toISOString();
				await saveInitProgress(progress);

				console.log(`    ⚠️ Turn ${turn.sequence} saved with default metadata`);
			} catch (saveError) {
				console.error(`    💥 Failed to save turn ${turn.sequence}:`, saveError);
				progress.status = 'failed';
				await saveInitProgress(progress);
				throw saveError;
			}
		}
	}

	// ✅ Mark as completed
	progress.status = 'completed';
	progress.lastUpdated = new Date().toISOString();
	await saveInitProgress(progress);

	console.log(`✅ Completed enriched processing for session "${sessionId}"`);
}

const cleanupCompletedProgress = async (): Promise<void> => {
	try {
		const progressFiles = await fs.readdir(PROGRESS_DIR);
		for (const file of progressFiles) {
			if (file.startsWith(PROGRESS_FILE_PREFIX)) {
				const filePath = path.join(PROGRESS_DIR, file);
				const data = await fs.readFile(filePath, 'utf-8');
				const progress: InitChatProgress = JSON.parse(data);

				if (progress.status === 'completed') {
					await fs.unlink(filePath);
					console.log(`🧹 Cleaned up completed progress file: ${file}`);
				}
			}
		}
	} catch (error) {
		console.warn('Failed to cleanup progress files:', error);
	}
};

// --- Main Seeding Logic ---
async function initChatFromLogFiles() {
	console.log(`🚀 Starting chat initialization with LLM enrichment...`);
	console.log(`Connecting to ChromaDB at: ${CHROMA_URL}`);
	console.log(`Using enrichment model: ${ENRICHMENT_MODEL}`);

	const chroma = new ChromaClient({ path: CHROMA_URL });

	try {
		console.log(`Ensuring main collection "${COLLECTIONS.CHAT}" exists...`);
		const collection: Collection = await chroma.getOrCreateCollection({
			name: COLLECTIONS.CHAT,
			metadata: {
				description: 'Stores enriched chat session turns with LLM-generated metadata.',
				created_by_script: 'initChat.ts',
				type: COLLECTIONS.CHAT,
				enrichment_model: ENRICHMENT_MODEL,
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
		console.log(`Found the following log files to process: ${convertArrayToString(allLogFiles)}`);

		const logFilesToProcess = allLogFiles;

		for (const logFile of logFilesToProcess) {
			const fileNameArr = path.basename(logFile, '.json').split('_');
			const characterId = buildCharacterId(fileNameArr[0], fileNameArr[1]);
			const TARGET_SESSION_ID = buildSessionId(characterId);

			console.log(`\n📝 Processing log file: "${logFile}" for session ID: "${TARGET_SESSION_ID}"...`);

			// ✅ Load or create progress
			let progress = await loadInitProgress(TARGET_SESSION_ID);

			const filePath = path.join(CRAWLER_RESULT_DIR, logFile);
			const fileContent = await fs.readFile(filePath, 'utf-8');
			const crawledLogs: MigChatMessage[] = JSON.parse(fileContent);

			if (!Array.isArray(crawledLogs) || crawledLogs.length === 0) {
				console.warn(`  No logs found or invalid format in "${logFile}". Skipping.`);
				continue;
			}

			// Create basic ChatTurn objects first
			const basicTurns: ChatTurn[] = [];
			const turnsMap = new Map<string, { user?: MigChatMessage; bot?: MigChatMessage }>();

			crawledLogs.forEach((log) => {
				const turnData = turnsMap.get(log.uuid) || {};
				if (log.role === 'user') {
					turnData.user = log;
				} else {
					turnData.bot = log;
				}
				turnsMap.set(log.uuid, turnData);
			});

			const sortedLogIds = Array.from(turnsMap.keys()).sort((a, b) => {
				const timeA = Date.parse(
					turnsMap.get(a)?.user?.createdAt || turnsMap.get(a)?.bot?.createdAt || ''
				);
				const timeB = Date.parse(
					turnsMap.get(b)?.user?.createdAt || turnsMap.get(b)?.bot?.createdAt || ''
				);
				return timeA - timeB;
			});

			// Create basic ChatTurn objects
			for (const [index, logId] of sortedLogIds.entries()) {
				const turnPair = turnsMap.get(logId);

				if (turnPair?.user && turnPair?.bot) {
					const userLog = turnPair.user;
					const botLog = turnPair.bot;
					const currentSequence = index;

					const requestMessage: ChatMessage = {
						role: 'user',
						messageId: buildMessageId(TARGET_SESSION_ID, currentSequence, 'request'),
						messageType: 'request',
						entries: parseTextToEntries(userLog.content),
						emotion: EMOTION_DEFAULT,
						createdAt: userLog.createdAt,
						updatedAt: userLog.updatedAt,
						showName: '요니브',
						type: METADATA_TYPES.MESSAGE,
						sessionId: TARGET_SESSION_ID,
						sequence: currentSequence,
					};

					function _isValidEmotion(emotion?: string): boolean {
						if (!emotion) return false;
						if (validEmotions.has(emotion)) return true;
						console.warn(` ⚠️ Invalid or unmapped emotion keyword: "${emotion}".`);
						return false;
					}

					const responseMessage: ChatMessage = {
						role: 'assistant',
						messageId: buildMessageId(TARGET_SESSION_ID, currentSequence, 'response'),
						messageType: 'response',
						entries: parseTextToEntries(botLog.content),
						emotion: botLog.emotion && _isValidEmotion(botLog.emotion) ? botLog.emotion : EMOTION_DEFAULT,
						createdAt: botLog.createdAt,
						updatedAt: botLog.updatedAt,
						model: botLog.model,
						sessionId: TARGET_SESSION_ID,
						showName: characterId.startsWith('tarion') ? '타리온' : '먼데이',
						type: METADATA_TYPES.MESSAGE,
						sequence: currentSequence,
					};

					const chatTurnId = buildChatTurnId(TARGET_SESSION_ID, currentSequence);

					const basicTurn: ChatTurn = {
						sessionId: TARGET_SESSION_ID,
						sequence: currentSequence,
						request: requestMessage,
						response: responseMessage,
						chatTurnId,
						type: METADATA_TYPES.TURN,
						requestMessageId: requestMessage.messageId,
						responseMessageId: responseMessage.messageId,
						createdAt: userLog.createdAt,
						// Add required base metadata fields with defaults
						characterId: characterId,
						updatedAt: new Date().toISOString(),
						// Add default enriched metadata (will be overwritten by LLM)
						...getDefaultEnrichedMetadata(),
					};

					basicTurns.push(basicTurn);
				} else {
					console.warn(
						`  Incomplete turn data for log_id "${logId}" in session "${TARGET_SESSION_ID}". Skipping.`
					);
				}
			}

			if (basicTurns.length > 0) {
				// ✅ Initialize progress if not exists
				if (!progress) {
					progress = createInitialProgress(TARGET_SESSION_ID, basicTurns.length);
					await saveInitProgress(progress);
				}

				// ✅ Skip already processed turns
				const turnsToProcess = basicTurns.slice(progress.processedTurns);

				if (turnsToProcess.length === 0) {
					console.log(`  ✅ All turns already processed for session "${TARGET_SESSION_ID}".`);
					continue;
				}

				console.log(
					`  📊 Processing ${turnsToProcess.length} remaining turns (${progress.processedTurns}/${basicTurns.length} already done)`
				);

				// ✅ Pass progress to the batch function
				await upsertEnrichedInBatchesWithProgress(
					collection,
					turnsToProcess,
					UPSERT_BATCH_SIZE,
					TARGET_SESSION_ID,
					progress
				);
			}
		}
	} catch (error) {
		console.error('❌ Error during enriched chat initialization:', error);
		process.exit(1);
	}
	await cleanupCompletedProgress();
}

initChatFromLogFiles();
