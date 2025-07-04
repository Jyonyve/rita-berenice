// scripts/chat/initChat.ts

import fs from 'node:fs/promises';
import path from 'node:path';
import { ChromaClient, Collection } from 'chromadb';
import { fileURLToPath } from 'node:url';
import { ChatMessage, ChatTurn, MigChatMessage } from '#shared/domain/chat/ChatInterfaces.js';
import {
	buildChatTurnMetadataPrompt,
	buildCharacterId,
	buildChatTurnId,
	buildMessageId,
	flatChatTurnToDoc,
	buildSessionId,
} from '#server/util/index.js';
import {
	parseChatTurnToMetadata,
	parseSessionId,
	parseTextToEntries,
} from '#shared/util/chatParseUtils.js';
import { COLLECTIONS } from '#server/db/ChromaInterfaces.js';
import { validEmotions } from '#shared/config/emotionWordsMapper.js';
import { METADATA_TYPES } from '#shared/config/constants.js';
import { chatStore } from '#server/store/chatStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configuration ---
const CHROMA_URL = process.env.CHROMA_API_URL || 'https://chromadb-flyio.fly.dev';
const CRAWLER_RESULT_DIR = path.join(__dirname, 'result');
const EMOTION_DEFAULT = 'default';
const MAX_LLM_RETRIES = 5;
const USER_ID = process.env.USER_ID || '6b335673-c837-43f9-a1c7-0b92c90edefb';

// LLM Configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyDcw_sDLQSjD0fJARHJNaRoIZv_Se6YGj8';
// const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyAfhl_AyupNyz9CpxscySkvGmxRsJKcXxk';
const ENRICHMENT_MODEL = 'gemini-2.0-flash-001'; // Fast model for metadata extraction

// --- ADJUST THESE FOR DEBUGGING ---
const UPSERT_BATCH_SIZE = 10; // Smaller batch size for enriched turns
const DELAY_BETWEEN_LLM_CALLS_MS = 1000; // Delay between individual LLM calls
// ---

// ✅ Add Progress Tracking Configuration
const PROGRESS_DIR = path.join(__dirname, 'progress');
const PROGRESS_FILE_PREFIX = 'initchat-progress';

interface InitChatProgress {
	sessionId: string;
	totalTurnsInLogFile: number;
	lastProcessedSequence: number;
	successfullyEnrichedTurnsCount: number;
	fallbackSavedTurnsCount: number;
	startedAt: string;
	lastUpdatedAt: string;
	status: 'in_progress' | 'completed' | 'failed';
	errors: Array<{ sequence: number; error: string; timestamp: string }>;
}

const getProgressFilePath = (sessionId: string): string => {
	return path.join(PROGRESS_DIR, `${PROGRESS_FILE_PREFIX}-${sessionId}.json`);
};

const loadInitProgress = async (sessionId: string): Promise<InitChatProgress | null> => {
	try {
		await fs.mkdir(PROGRESS_DIR, { recursive: true });
		const progressFile = getProgressFilePath(sessionId);
		const data = await fs.readFile(progressFile, 'utf-8');
		return JSON.parse(data);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return null;
		}
		console.warn(`Warning: Could not load progress file for ${sessionId}:`, error);
		return null;
	}
};

const saveInitProgress = async (progress: InitChatProgress): Promise<void> => {
	progress.lastUpdatedAt = new Date().toISOString();
	try {
		await fs.mkdir(PROGRESS_DIR, { recursive: true });
		const progressFile = getProgressFilePath(progress.sessionId);
		await fs.writeFile(progressFile, JSON.stringify(progress, null, 2));
	} catch (error) {
		console.error(`Failed to save progress for session ${progress.sessionId}:`, error);
	}
};

const createInitialProgress = (
	sessionId: string,
	totalTurnsInLogFile: number
): InitChatProgress => {
	return {
		sessionId,
		totalTurnsInLogFile,
		lastProcessedSequence: -1,
		successfullyEnrichedTurnsCount: 0,
		fallbackSavedTurnsCount: 0,
		startedAt: new Date().toISOString(),
		lastUpdatedAt: new Date().toISOString(),
		status: 'in_progress',
		errors: [],
	};
};

// --- LLM and Data Processing Functions (Unchanged) ---
// ... (extractJsonFromMarkdown, generateEnrichedMetadataLLM, getDefaultEnrichedMetadata, enrichChatTurnWithMetadata, processAndUpsertTurn functions remain the same as in your file) ...
// NOTE: For brevity, the unchanged helper functions are omitted here. Please keep them in your actual file.
const extractJsonFromMarkdown = (response: string): any => {
	let cleaned = response.trim();
	try {
		const codeBlockMatch = cleaned.match(/``````/i);
		if (codeBlockMatch && codeBlockMatch[1]) {
			return JSON.parse(codeBlockMatch[1]);
		}
		const jsonMatch = cleaned.match(/(\{[\s\S]*\})/);
		if (jsonMatch && jsonMatch[1]) {
			return JSON.parse(jsonMatch[1]);
		}
		if (!cleaned.startsWith('{') && cleaned.includes('{') && cleaned.includes('}')) {
			const firstBrace = cleaned.indexOf('{');
			const lastBrace = cleaned.lastIndexOf('}');
			if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
				cleaned = cleaned.substring(firstBrace, lastBrace + 1);
			}
		}
		return JSON.parse(cleaned);
	} catch (error) {
		console.error('JSON extraction failed. Raw text snippet:', cleaned.substring(0, 500));
		return {};
	}
};
const generateEnrichedMetadataLLM = async (prompt: string, attempt = 1): Promise<string> => {
	if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY environment variable is required.');
	console.log(`    📞 Calling Gemini API (Attempt ${attempt}/${MAX_LLM_RETRIES})...`);
	try {
		const response = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/${ENRICHMENT_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					contents: [{ parts: [{ text: prompt }] }],
					generationConfig: { temperature: 0.3, maxOutputTokens: 1536 },
				}),
			}
		);
		if (!response.ok) {
			const errorBody = await response.text();
			console.warn(
				`    ⚠️ Gemini API non-OK response (Status ${response.status}): ${response.statusText}. Body: ${errorBody.substring(0, 200)}`
			);
			if (response.status === 429 && attempt < MAX_LLM_RETRIES) {
				const retryAfterHeader = response.headers.get('retry-after');
				const waitTimeSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 60;
				const waitTimeMs = Math.max(waitTimeSeconds * 1000, 5000);
				console.warn(`    ⏳ Gemini rate limited. Waiting ${waitTimeMs / 1000}s`);
				await new Promise((resolve) => setTimeout(resolve, waitTimeMs));
				return generateEnrichedMetadataLLM(prompt, attempt + 1);
			}
			if (attempt < MAX_LLM_RETRIES) {
				const backoffTime = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
				console.warn(`    ↪️ Retrying LLM in ${backoffTime / 1000}s...`);
				await new Promise((resolve) => setTimeout(resolve, backoffTime));
				return generateEnrichedMetadataLLM(prompt, attempt + 1);
			}
			throw new Error(
				`Gemini API Error: ${response.status} ${response.statusText} after ${attempt} attempts.`
			);
		}
		const data = await response.json();
		const candidate = data.candidates?.[0];
		const content = candidate?.content?.parts?.[0]?.text || '';
		if (
			candidate?.finishReason &&
			candidate.finishReason !== 'STOP' &&
			candidate.finishReason !== 'MAX_TOKENS'
		) {
			console.warn(`    ⚠️ Gemini API finishReason: ${candidate.finishReason}.`);
			if (candidate.finishReason === 'SAFETY')
				throw new Error('Gemini API: Content blocked due to safety settings.');
		}
		if (!content) {
			console.warn('    ⚠️ Empty content from Gemini API:', JSON.stringify(data).substring(0, 500));
			throw new Error('Empty response content from Gemini API');
		}
		console.log(`    🗣️ Gemini API response received (length: ${content.length}).`);
		return content;
	} catch (error) {
		console.error(
			`    💥 LLM Error (Attempt ${attempt}/${MAX_LLM_RETRIES}):`,
			error instanceof Error ? error.message : String(error)
		);
		if (attempt < MAX_LLM_RETRIES) {
			const backoffTime = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
			console.warn(`    ↪️ Retrying LLM in ${backoffTime / 1000}s...`);
			await new Promise((resolve) => setTimeout(resolve, backoffTime));
			return generateEnrichedMetadataLLM(prompt, attempt + 1);
		}
		throw error;
	}
};
const getDefaultEnrichedMetadata = () => ({
	summary: 'N/A',
	keywords: [],
	topics: [],
	entities: [],
	userEmotion: { primary: 'neutral', intensity: 0.5, nuances: [] },
	characterEmotion: { primary: 'neutral', intensity: 0.5, nuances: [] },
	relationshipShifts: [],
	dialogueAct: 'N/A',
	actions: [],
	loreReferences: [],
	historyReferences: [],
	flags: [],
	memoryChunk: 'N/A',
});
const enrichChatTurnWithMetadata = async (
	basicTurn: ChatTurn,
	existingLoreIds: string[] = [],
	existingHistoryIds: string[] = []
): Promise<ChatTurn> => {
	const prompt = buildChatTurnMetadataPrompt(
		{ showName: basicTurn.request.showName, name: 'yonyve', gender: 'female' },
		basicTurn.request,
		{ showName: basicTurn.response.showName, name: 'tarion', gender: 'male' },
		basicTurn.response,
		existingLoreIds,
		existingHistoryIds
	);
	const llmResponse = await generateEnrichedMetadataLLM(prompt);
	const parsedLlmJson = extractJsonFromMarkdown(llmResponse);
	const defaults = getDefaultEnrichedMetadata();
	return {
		...basicTurn,
		summary: parsedLlmJson.summary || defaults.summary,
		keywords: parsedLlmJson.keywords || defaults.keywords,
		topics: parsedLlmJson.topics || defaults.topics,
		entities: parsedLlmJson.entities || defaults.entities,
		userEmotion: {
			primary: parsedLlmJson.userEmotion?.primary || defaults.userEmotion.primary,
			intensity: parsedLlmJson.userEmotion?.intensity || defaults.userEmotion.intensity,
			nuances: parsedLlmJson.userEmotion?.nuances || defaults.userEmotion.nuances,
		},
		characterEmotion: {
			primary: parsedLlmJson.characterEmotion?.primary || defaults.characterEmotion.primary,
			intensity: parsedLlmJson.characterEmotion?.intensity || defaults.characterEmotion.intensity,
			nuances: parsedLlmJson.characterEmotion?.nuances || defaults.characterEmotion.nuances,
		},
		relationshipShifts: parsedLlmJson.relationshipShifts || defaults.relationshipShifts,
		dialogueAct: parsedLlmJson.dialogueAct || defaults.dialogueAct,
		actions: parsedLlmJson.actions || defaults.actions,
		loreReferences: parsedLlmJson.loreReferences || defaults.loreReferences,
		historyReferences: parsedLlmJson.historyReferences || defaults.historyReferences,
		flags: parsedLlmJson.flags || defaults.flags,
		memoryChunk: parsedLlmJson.memoryChunk || defaults.memoryChunk,
		characterId: basicTurn.characterId || parseSessionId(basicTurn.sessionId).characterId,
		updatedAt: new Date().toISOString(),
	};
};
async function processAndUpsertTurn(turnToProcess: ChatTurn, progress: InitChatProgress) {
	let enrichedTurnResult: ChatTurn;
	let wasEnrichedSuccessfully = false;

	try {
		console.log(
			`    🧠 Enriching turn ${turnToProcess.sequence} (${progress.lastProcessedSequence + 2}/${progress.totalTurnsInLogFile})...`
		);
		enrichedTurnResult = await enrichChatTurnWithMetadata(turnToProcess);
		wasEnrichedSuccessfully = true;
		progress.successfullyEnrichedTurnsCount++;
		console.log(`    🗣️ Turn ${turnToProcess.sequence} LLM enrichment successful.`);
	} catch (enrichmentError) {
		const errorMessage =
			enrichmentError instanceof Error ? enrichmentError.message : String(enrichmentError);
		console.error(`    ❌ LLM Enrichment failed for turn ${turnToProcess.sequence}: ${errorMessage}`);
		progress.errors.push({
			sequence: turnToProcess.sequence,
			error: `Enrichment failed: ${errorMessage}`,
			timestamp: new Date().toISOString(),
		});
		enrichedTurnResult = {
			...turnToProcess,
			...getDefaultEnrichedMetadata(),
			characterId: turnToProcess.characterId || parseSessionId(turnToProcess.sessionId).characterId,
			updatedAt: new Date().toISOString(),
		};
		console.warn(`    ↪️ Using default (rich) metadata for turn ${turnToProcess.sequence}.`);
		progress.fallbackSavedTurnsCount++;
	}

	try {
		// Use the high-level store function. It handles the upsert internally.
		// It already contains all the necessary logic from your application.
		await chatStore._storeFullChatTurn(enrichedTurnResult);

		progress.lastProcessedSequence = enrichedTurnResult.sequence;
		console.log(
			`    ✅ Turn ${enrichedTurnResult.sequence} ${wasEnrichedSuccessfully ? 'enriched' : 'fallback'} and saved via chatStore. Progress: ${progress.lastProcessedSequence + 1}/${progress.totalTurnsInLogFile}`
		);
	} catch (dbError) {
		const dbErrorMessage = dbError instanceof Error ? dbError.message : String(dbError);
		console.error(
			`    💥 CRITICAL DB Error saving turn ${enrichedTurnResult.sequence}: ${dbErrorMessage}`
		);
		progress.errors.push({
			sequence: enrichedTurnResult.sequence,
			error: `DB Upsert failed: ${dbErrorMessage}`,
			timestamp: new Date().toISOString(),
		});
		progress.status = 'failed';
		await saveInitProgress(progress);
		throw new Error(`CRITICAL DB Error for turn ${enrichedTurnResult.sequence}: ${dbErrorMessage}`);
	}
}
// ---

async function initChatFromLogFiles() {
	console.log(`🚀 Starting chat initialization with LLM enrichment...`);
	if (!GEMINI_API_KEY) {
		console.error('🚨 GEMINI_API_KEY is not set. Aborting.');
		process.exit(1);
	}
	console.log(`Using enrichment model: ${ENRICHMENT_MODEL}`);

	// --- REFACTOR START ---
	// We no longer need to initialize the client or get the collection here.
	// The `chatStore` will handle this automatically via its cached `getChatCollection` method.
	console.log(`Ensuring connection to ChromaDB via centralized client...`);
	try {
		// We can "warm up" the connection by calling the store's getter.
		// This will ensure the collection exists before the loop starts.
		await chatStore._getChatCollection();
		console.log(`Collection "${COLLECTIONS.CHAT}" is ready via chatStore.`);
	} catch (e) {
		const errorMessage = e instanceof Error ? e.message : String(e);
		console.error(
			`🚨 Failed to connect to or create ChromaDB collection "${COLLECTIONS.CHAT}" via chatStore. Aborting. Error: ${errorMessage}`
		);
		process.exit(1);
	}

	const allLogFiles = (await fs.readdir(CRAWLER_RESULT_DIR)).filter((file) =>
		file.endsWith('.json')
	);

	if (allLogFiles.length === 0) {
		console.log(`No JSON log files found in ${CRAWLER_RESULT_DIR}. Nothing to process.`);
		return;
	}
	console.log(`Found the following log files to process: ${allLogFiles.join(', ')}`);

	for (const logFile of allLogFiles) {
		const fileNameParts = path.basename(logFile, '.json').split('_');
		// --- REFACTOR ---
		// It is CRITICAL that filenames are stable. Using a timestamp in the filename
		// will cause a new sessionId to be generated every time.
		// Good filename: `MyCharacter_Original.json`
		// Bad filename:  `MyCharacter_Original_1686774840.json`
		if (fileNameParts.length < 2) {
			console.warn(
				`  ⚠️ Invalid log file name format: "${logFile}". Should be 'characterName_variant'. Skipping.`
			);
			continue;
		}
		const characterNameFromFile = fileNameParts[0];
		const characterVariantFromFile = fileNameParts[1];

		const characterId = buildCharacterId(characterNameFromFile, characterVariantFromFile);
		const TARGET_SESSION_ID = buildSessionId(characterId);
		// const TARGET_SESSION_ID = 'tarion_spinoff_SREDt3inUBm5wMBu';

		console.log(`\n📝 Processing log file: "${logFile}" for session ID: "${TARGET_SESSION_ID}"...`);

		let progress = await loadInitProgress(TARGET_SESSION_ID);
		let crawledLogs: MigChatMessage[];
		try {
			const fileContent = await fs.readFile(path.join(CRAWLER_RESULT_DIR, logFile), 'utf-8');
			crawledLogs = JSON.parse(fileContent);
		} catch (fileError) {
			console.error(`  ❌ Error reading or parsing log file "${logFile}":`, fileError);
			if (progress) {
				progress.errors.push({
					sequence: -1,
					error: `Failed to read/parse log file: ${fileError instanceof Error ? fileError.message : String(fileError)}`,
					timestamp: new Date().toISOString(),
				});
				await saveInitProgress(progress);
			}
			continue;
		}

		if (!Array.isArray(crawledLogs) || crawledLogs.length === 0) {
			console.warn(`  No logs found or invalid format in "${logFile}". Skipping.`);
			continue;
		}

		// Convert logs to a standardized ChatTurn format
		const basicTurnsFromLog: ChatTurn[] = [];
		// ... (Your logic for parsing crawledLogs into basicTurnsFromLog remains the same)
		const turnsMap = new Map<string, { user?: MigChatMessage; bot?: MigChatMessage }>();
		crawledLogs.forEach((log) => {
			const turnUuid = log.uuid || `${log.createdAt}_${log.role}`;
			const turnData = turnsMap.get(turnUuid) || {};
			if (log.role === 'user') turnData.user = log;
			else turnData.bot = log;
			turnsMap.set(turnUuid, turnData);
		});
		const sortedUuids = Array.from(turnsMap.keys()).sort(
			(a, b) =>
				Date.parse(turnsMap.get(a)?.user?.createdAt || '0') -
				Date.parse(turnsMap.get(b)?.user?.createdAt || '0')
		);
		for (const [index, uuid] of sortedUuids.entries()) {
			const turnPair = turnsMap.get(uuid);
			if (turnPair?.user && turnPair?.bot) {
				const [userLog, botLog] = [turnPair.user, turnPair.bot];
				const currentSequence = index;
				const requestMessage: ChatMessage = {
					role: 'user',
					messageId: buildMessageId(TARGET_SESSION_ID, currentSequence, 'request'),
					messageType: 'request',
					entries: parseTextToEntries(userLog.content),
					emotion: EMOTION_DEFAULT,
					createdAt: userLog.createdAt,
					updatedAt: userLog.updatedAt || userLog.createdAt,
					showName: userLog.showName || '요니브',
					type: METADATA_TYPES.MESSAGE,
					sessionId: TARGET_SESSION_ID,
					sequence: currentSequence,
				};
				const responseMessage: ChatMessage = {
					role: 'assistant',
					messageId: buildMessageId(TARGET_SESSION_ID, currentSequence, 'response'),
					messageType: 'response',
					entries: parseTextToEntries(botLog.content),
					emotion:
						botLog.emotion && validEmotions.has(botLog.emotion) ? botLog.emotion : EMOTION_DEFAULT,
					createdAt: botLog.createdAt,
					updatedAt: botLog.updatedAt || botLog.createdAt,
					model: botLog.model,
					sessionId: TARGET_SESSION_ID,
					showName: botLog.showName || characterNameFromFile,
					type: METADATA_TYPES.MESSAGE,
					sequence: currentSequence,
				};
				const basicTurn: ChatTurn = {
					sessionId: TARGET_SESSION_ID,
					userId: USER_ID,
					sequence: currentSequence,
					request: requestMessage,
					response: responseMessage,
					chatTurnId: buildChatTurnId(TARGET_SESSION_ID, currentSequence),
					type: METADATA_TYPES.TURN,
					requestMessageId: requestMessage.messageId,
					responseMessageId: responseMessage.messageId,
					createdAt: userLog.createdAt,
					characterId,
					updatedAt: new Date().toISOString(),
					...getDefaultEnrichedMetadata(),
				};
				basicTurnsFromLog.push(basicTurn);
			} else {
				console.warn(
					`  Incomplete turn data for UUID "${uuid}" in session "${TARGET_SESSION_ID}". Skipping.`
				);
			}
		}

		// --- REFACTOR START: Smarter progress handling ---
		if (!progress) {
			console.log(`  No progress file found for "${TARGET_SESSION_ID}". Creating a new one.`);
			progress = createInitialProgress(TARGET_SESSION_ID, basicTurnsFromLog.length);
		} else {
			const previouslyProcessedCount = progress.lastProcessedSequence + 1;
			if (progress.status === 'completed' && basicTurnsFromLog.length > previouslyProcessedCount) {
				console.log(
					`  🔄 New turns found in completed session "${TARGET_SESSION_ID}". Re-opening for processing.`
				);
				progress.status = 'in_progress';
				progress.totalTurnsInLogFile = basicTurnsFromLog.length; // Update total count
			} else if (progress.status === 'completed') {
				console.log(`  ✅ Session "${TARGET_SESSION_ID}" is up-to-date and completed. Skipping.`);
				continue;
			} else if (progress.status === 'failed') {
				console.warn(
					`  ❌ Session "${TARGET_SESSION_ID}" previously failed. Skipping. Please review and reset progress file manually if safe.`
				);
				continue;
			}
			// If in_progress, just update the total turn count in case the file grew
			progress.totalTurnsInLogFile = basicTurnsFromLog.length;
		}
		// --- REFACTOR END ---

		const nextSequenceToProcess = progress.lastProcessedSequence + 1;
		const turnsToProcessThisRun = basicTurnsFromLog.filter(
			(turn) => turn.sequence >= nextSequenceToProcess
		);

		if (turnsToProcessThisRun.length === 0) {
			console.log(
				`  No new turns to process for session "${TARGET_SESSION_ID}". (Last processed sequence: ${progress.lastProcessedSequence})`
			);
			if (
				progress.lastProcessedSequence + 1 >= progress.totalTurnsInLogFile &&
				progress.totalTurnsInLogFile > 0
			) {
				progress.status = 'completed';
				console.log(`  Marking session "${TARGET_SESSION_ID}" as completed.`);
			}
			await saveInitProgress(progress);
			continue;
		}

		console.log(
			`  📊 Starting processing of ${turnsToProcessThisRun.length} turns for session "${TARGET_SESSION_ID}" (from sequence ${nextSequenceToProcess}).`
		);
		await saveInitProgress(progress);

		for (let i = 0; i < turnsToProcessThisRun.length; i++) {
			const turn = turnsToProcessThisRun[i];
			try {
				await processAndUpsertTurn(turn, progress);
				await saveInitProgress(progress);
			} catch (turnProcessingError) {
				console.error(
					`  🛑 Halting processing for session "${TARGET_SESSION_ID}" due to critical error on turn ${turn.sequence}.`
				);
				break;
			}

			if (i < turnsToProcessThisRun.length - 1 && progress.status !== 'failed') {
				await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_LLM_CALLS_MS));
			}
		}

		if (progress.status !== 'failed') {
			if (progress.lastProcessedSequence + 1 >= progress.totalTurnsInLogFile) {
				progress.status = 'completed';
				console.log(
					`🎉 Session "${TARGET_SESSION_ID}" fully completed! Processed ${progress.lastProcessedSequence + 1} turns.`
				);
			} else {
				console.log(
					`🟡 Session "${TARGET_SESSION_ID}" processing partially complete. Processed up to sequence ${progress.lastProcessedSequence}.`
				);
			}
		}
		await saveInitProgress(progress);
	}

	console.log('\n🎉 Chat initialization with LLM enrichment finished for all files.');
	// --- REFACTOR ---
	// The cleanup function is disabled as it prevents incremental updates.
	// await cleanupAndBackupCompletedProgress();
	console.log(
		'✅ Process complete. Completed progress files are kept in place for future incremental updates.'
	);
}

initChatFromLogFiles().catch((err) => {
	console.error('🚨🚨🚨 FATAL Unhandled error in initChatFromLogFiles outer scope:', err);
	process.exit(1);
});

// The cleanupAndBackupCompletedProgress function is no longer called, but you can keep it for manual archival if needed.
// It is recommended NOT to run it automatically.
const cleanupAndBackupCompletedProgress = async (): Promise<void> => {
	/* ... */
};
