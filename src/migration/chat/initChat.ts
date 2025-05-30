// scripts/chat/initChat.ts

import fs from 'node:fs/promises';
import path from 'node:path';
import { ChromaClient, Collection } from 'chromadb';
import { fileURLToPath } from 'node:url';
import { ChatMessage, ChatTurn, MigChatMessage } from '#shared/domain/chat/ChatInterfaces.ts';
import { buildChatTurnMetadataPrompt } from '#root/src/server/util/templateUtils.ts';
import {
	parseChatTurnToMetadata,
	parseSessionId,
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
import {
	allEmotionKeywordsList,
	validEmotions,
} from '#root/src/shared/config/emotionWordsMapper.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configuration ---
const CHROMA_URL = process.env.CHROMA_API_URL || 'https://chromadb-flyio.fly.dev';
const CRAWLER_RESULT_DIR = path.join(__dirname, 'result');
const EMOTION_DEFAULT = 'default';
const MAX_LLM_RETRIES = 5;

// LLM Configuration
// const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyDcw_sDLQSjD0fJARHJNaRoIZv_Se6YGj8';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyAfhl_AyupNyz9CpxscySkvGmxRsJKcXxk';
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
		// If file not found or other error, return null
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

const extractJsonFromMarkdown = (response: string): any => {
	let cleaned = response.trim();
	try {
		// Try to find JSON between markdown code blocks first
		const codeBlockMatch = cleaned.match(/``````/i);
		if (codeBlockMatch && codeBlockMatch[1]) {
			return JSON.parse(codeBlockMatch[1]);
		}

		// If no code blocks, try to find a JSON object directly
		const jsonMatch = cleaned.match(/(\{[\s\S]*\})/);
		if (jsonMatch && jsonMatch[1]) {
			return JSON.parse(jsonMatch[1]);
		}

		// Fallback for cases where LLM might forget closing braces or includes extra text
		if (!cleaned.startsWith('{') && cleaned.includes('{') && cleaned.includes('}')) {
			const firstBrace = cleaned.indexOf('{');
			const lastBrace = cleaned.lastIndexOf('}');
			if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
				cleaned = cleaned.substring(firstBrace, lastBrace + 1);
			}
		}
		return JSON.parse(cleaned);
	} catch (error) {
		console.error(
			'JSON extraction failed. Raw text snippet for debugging:',
			cleaned.substring(0, 500)
		);
		return {}; // Return empty object to allow default filling
	}
};

const generateEnrichedMetadataLLM = async (prompt: string, attempt = 1): Promise<string> => {
	if (!GEMINI_API_KEY) {
		throw new Error('GEMINI_API_KEY environment variable is required for LLM calls.');
	}

	console.log(`    📞 Calling Gemini API (Attempt ${attempt}/${MAX_LLM_RETRIES})...`);

	try {
		const response = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/${ENRICHMENT_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					contents: [{ parts: [{ text: prompt }] }],
					generationConfig: {
						temperature: 0.3,
						maxOutputTokens: 1536, // Increased for potentially larger JSON
					},
				}),
			}
		);

		if (!response.ok) {
			const errorBody = await response.text();
			console.warn(
				`    ⚠️ Gemini API non-OK response (Status ${response.status}): ${response.statusText}. Body: ${errorBody.substring(0, 200)}`
			);
			if (response.status === 429) {
				if (attempt < MAX_LLM_RETRIES) {
					const retryAfterHeader = response.headers.get('retry-after');
					const waitTimeSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 60;
					const waitTimeMs = Math.max(waitTimeSeconds * 1000, 5000);
					console.warn(`    ⏳ Gemini rate limited. Waiting ${waitTimeMs / 1000}s (Attempt ${attempt})`);
					await new Promise((resolve) => setTimeout(resolve, waitTimeMs));
					return generateEnrichedMetadataLLM(prompt, attempt + 1);
				}
				throw new Error(`Gemini API rate limited after ${MAX_LLM_RETRIES} attempts (Status 429)`);
			}
			if (attempt < MAX_LLM_RETRIES) {
				const backoffTime = Math.pow(2, attempt) * 1000 + Math.random() * 1000; // Exponential backoff for other errors
				console.warn(`    ↪️ Retrying LLM due to non-429 error in ${backoffTime / 1000}s...`);
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
			console.warn(
				`    ⚠️ Gemini API finishReason: ${candidate.finishReason}. Content might be incomplete or problematic.`
			);
			if (candidate.finishReason === 'SAFETY') {
				throw new Error('Gemini API: Content blocked due to safety settings.');
			}
		}
		if (!content) {
			console.warn(
				'    ⚠️ Empty content from Gemini API. Full response:',
				JSON.stringify(data).substring(0, 500)
			);
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
		console.error(`    🚫 Failed LLM call after ${MAX_LLM_RETRIES} attempts.`);
		throw error;
	}
};

// This function should return the rich object structure expected by ChatTurn
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
	basicTurn: ChatTurn, // Input is a basic ChatTurn (from logs, with default rich metadata)
	existingLoreIds: string[] = [],
	existingHistoryIds: string[] = []
): Promise<ChatTurn> => {
	// Output is a ChatTurn with LLM-generated rich metadata
	// Derive display names with English spellings
	const userNameDisplay = `${basicTurn.request.showName}(Yonyve)`; // Replace with actual logic if needed
	const charNameDisplay = `${basicTurn.response.showName}(Tarion)`; // Replace with actual logic if needed
	const userGender = 'female'; // Placeholder - fetch from profile if available
	const charGender = basicTurn.response.showName === '타리온' ? 'male' : 'male'; // Placeholder

	const prompt = buildChatTurnMetadataPrompt(
		userNameDisplay,
		userGender,
		basicTurn.request,
		charNameDisplay,
		charGender,
		basicTurn.response,
		existingLoreIds,
		existingHistoryIds
	);

	const llmResponse = await generateEnrichedMetadataLLM(prompt);
	const parsedLlmJson = extractJsonFromMarkdown(llmResponse);
	const defaults = getDefaultEnrichedMetadata();

	// Merge LLM response with defaults to create the rich object structure
	return {
		...basicTurn, // Spread the original basic turn (includes request, response, sequence, etc.)
		summary: parsedLlmJson.summary || defaults.summary,
		keywords: parsedLlmJson.keywords || defaults.keywords,
		topics: parsedLlmJson.topics || defaults.topics,
		entities: parsedLlmJson.entities || defaults.entities,
		userEmotion: {
			// Ensure nested objects are correctly formed
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
		// Ensure characterId is present and updatedAt is refreshed
		characterId: basicTurn.characterId || parseSessionId(basicTurn.sessionId).characterId,
		updatedAt: new Date().toISOString(),
	};
};

async function processAndUpsertTurn(
	collection: Collection,
	turnToProcess: ChatTurn, // This is a basic turn from the log file
	progress: InitChatProgress
) {
	let enrichedTurnResult: ChatTurn; // This will hold the ChatTurn with rich metadata
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

		// Create a fallback turn with default (rich) enriched metadata
		enrichedTurnResult = {
			...turnToProcess, // Start with the basic turn from the log
			...getDefaultEnrichedMetadata(), // Spread the default rich metadata
			characterId: turnToProcess.characterId || parseSessionId(turnToProcess.sessionId).characterId,
			updatedAt: new Date().toISOString(),
		};
		console.warn(`    ↪️ Using default (rich) metadata for turn ${turnToProcess.sequence}.`);
		progress.fallbackSavedTurnsCount++;
	}

	// Convert the (either enriched or fallback) RICH ChatTurn object to PRIMITIVE metadata for ChromaDB
	const chromaCompatibleMetadata = parseChatTurnToMetadata(enrichedTurnResult);
	const documentForEmbedding = buildChatTurnDocument(enrichedTurnResult);

	try {
		await collection.upsert({
			ids: [enrichedTurnResult.chatTurnId],
			documents: [documentForEmbedding],
			metadatas: [chromaCompatibleMetadata],
		});

		progress.lastProcessedSequence = enrichedTurnResult.sequence;
		console.log(
			`    ✅ Turn ${enrichedTurnResult.sequence} ${wasEnrichedSuccessfully ? 'enriched' : 'fallback'} and saved. Progress: ${progress.lastProcessedSequence + 1}/${progress.totalTurnsInLogFile}`
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
		await saveInitProgress(progress); // Save progress before throwing
		throw new Error(`CRITICAL DB Error for turn ${enrichedTurnResult.sequence}: ${dbErrorMessage}`);
	}
}

async function initChatFromLogFiles() {
	console.log(`🚀 Starting chat initialization with LLM enrichment...`);
	if (!GEMINI_API_KEY) {
		console.error('🚨 GEMINI_API_KEY is not set. Aborting.');
		process.exit(1); // Critical error, stop execution
	}
	console.log(`Connecting to ChromaDB at: ${CHROMA_URL}`);
	console.log(`Using enrichment model: ${ENRICHMENT_MODEL}`);

	const chroma = new ChromaClient({ path: CHROMA_URL });
	let collection: Collection;

	try {
		console.log(`Ensuring main collection "${COLLECTIONS.CHAT}" exists...`);
		collection = await chroma.getOrCreateCollection({
			name: COLLECTIONS.CHAT,
			metadata: {
				description: 'Stores enriched chat session turns with LLM-generated metadata.',
				created_by_script: 'initChat.ts',
				type: COLLECTIONS.CHAT, // Ensure this matches your METADATA_TYPES
				enrichment_model: ENRICHMENT_MODEL,
			},
		});
		console.log(`Collection "${COLLECTIONS.CHAT}" ready.`);
	} catch (e) {
		const collectionError = e instanceof Error ? e.message : String(e);
		console.error(
			`🚨 Failed to get or create ChromaDB collection "${COLLECTIONS.CHAT}". Aborting. Error: ${collectionError}`
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
		// Expecting format like: characterName_variant_timestamp.json
		if (fileNameParts.length < 2) {
			console.warn(`  ⚠️ Invalid log file name format: "${logFile}". Skipping.`);
			continue;
		}
		const characterNameFromFile = fileNameParts[0];
		const characterVariantFromFile = fileNameParts[1]; // e.g., "original", "spinoff"

		const characterId = buildCharacterId(characterNameFromFile, characterVariantFromFile);
		const TARGET_SESSION_ID = buildSessionId(characterId);

		console.log(
			`\n📝 Processing log file: "${logFile}" for session ID: "${TARGET_SESSION_ID}" (Character: ${characterId})...`
		);
		let progress = await loadInitProgress(TARGET_SESSION_ID);

		const filePath = path.join(CRAWLER_RESULT_DIR, logFile);
		let crawledLogs: MigChatMessage[];
		try {
			const fileContent = await fs.readFile(filePath, 'utf-8');
			crawledLogs = JSON.parse(fileContent);
		} catch (fileError) {
			console.error(`  ❌ Error reading or parsing log file "${logFile}":`, fileError);
			if (progress) {
				// If progress file exists, mark this attempt as problematic
				progress.errors.push({
					sequence: -1,
					error: `Failed to read/parse log file: ${fileError instanceof Error ? fileError.message : String(fileError)}`,
					timestamp: new Date().toISOString(),
				});
				await saveInitProgress(progress);
			}
			continue; // Skip to next file
		}

		if (!Array.isArray(crawledLogs) || crawledLogs.length === 0) {
			console.warn(`  No logs found or invalid format in "${logFile}". Skipping.`);
			continue;
		}

		// Convert MigChatMessage to basic ChatTurn objects
		const basicTurnsFromLog: ChatTurn[] = [];
		const turnsMap = new Map<string, { user?: MigChatMessage; bot?: MigChatMessage }>();

		crawledLogs.forEach((log) => {
			const turnUuid = log.uuid || `${log.createdAt}_${log.role}`; // Use a fallback if uuid is missing
			const turnData = turnsMap.get(turnUuid) || {};
			if (log.role === 'user') {
				turnData.user = log;
			} else {
				turnData.bot = log;
			}
			turnsMap.set(turnUuid, turnData);
		});

		const sortedUuids = Array.from(turnsMap.keys()).sort((a, b) => {
			const timeA = Date.parse(
				turnsMap.get(a)?.user?.createdAt || turnsMap.get(a)?.bot?.createdAt || '0'
			);
			const timeB = Date.parse(
				turnsMap.get(b)?.user?.createdAt || turnsMap.get(b)?.bot?.createdAt || '0'
			);
			return timeA - timeB;
		});

		for (const [index, uuid] of sortedUuids.entries()) {
			const turnPair = turnsMap.get(uuid);

			if (turnPair?.user && turnPair?.bot) {
				const userLog = turnPair.user;
				const botLog = turnPair.bot;
				const currentSequence = index; // This is the 0-indexed sequence for the session

				const requestMessage: ChatMessage = {
					role: 'user',
					messageId: buildMessageId(TARGET_SESSION_ID, currentSequence, 'request'),
					messageType: 'request',
					entries: parseTextToEntries(userLog.content),
					emotion: EMOTION_DEFAULT,
					createdAt: userLog.createdAt,
					updatedAt: userLog.updatedAt || userLog.createdAt,
					showName: userLog.showName || '요니브', // Provide a default if showName is missing
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
					showName: botLog.showName || characterNameFromFile, // Use character name from file
					type: METADATA_TYPES.MESSAGE,
					sequence: currentSequence,
				};

				const chatTurnId = buildChatTurnId(TARGET_SESSION_ID, currentSequence);

				// Create a basic ChatTurn with default RICH OBJECTS for enriched fields
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
					characterId, // Assign derived characterId
					updatedAt: new Date().toISOString(), // Initial updatedAt
					...getDefaultEnrichedMetadata(), // Spread default rich metadata
				};
				basicTurnsFromLog.push(basicTurn);
			} else {
				console.warn(
					`  Incomplete turn data for UUID "${uuid}" in session "${TARGET_SESSION_ID}". Skipping.`
				);
			}
		}

		if (!progress) {
			progress = createInitialProgress(TARGET_SESSION_ID, basicTurnsFromLog.length);
		} else if (progress.status === 'completed') {
			console.log(`  ✅ Session "${TARGET_SESSION_ID}" already fully completed. Skipping.`);
			continue;
		} else if (progress.status === 'failed') {
			console.warn(
				`  ❌ Session "${TARGET_SESSION_ID}" previously failed. Last error for seq ${progress.errors[progress.errors.length - 1]?.sequence}: ${progress.errors[progress.errors.length - 1]?.error}. Review and consider resetting progress file if safe.`
			);
			continue;
		}
		progress.totalTurnsInLogFile = basicTurnsFromLog.length; // Update total, in case log file changed

		const nextSequenceToProcess = progress.lastProcessedSequence + 1;
		const turnsToProcessThisRun = basicTurnsFromLog.filter(
			(turn) => turn.sequence >= nextSequenceToProcess
		);

		if (turnsToProcessThisRun.length === 0) {
			console.log(
				`  No new turns to process for session "${TARGET_SESSION_ID}" (Last processed sequence: ${progress.lastProcessedSequence}).`
			);
			if (
				progress.lastProcessedSequence + 1 >= progress.totalTurnsInLogFile &&
				progress.totalTurnsInLogFile > 0
			) {
				progress.status = 'completed';
				console.log(`  Marking session "${TARGET_SESSION_ID}" as completed.`);
			} else if (progress.totalTurnsInLogFile === 0) {
				progress.status = 'completed'; // No turns in log, consider it completed
				console.log(
					`  Log file for session "${TARGET_SESSION_ID}" has no processable turns. Marking as completed.`
				);
			}
			await saveInitProgress(progress);
			continue;
		}

		console.log(
			`  📊 Starting processing of ${turnsToProcessThisRun.length} turns for session "${TARGET_SESSION_ID}" (from sequence ${nextSequenceToProcess}). Total in log: ${basicTurnsFromLog.length}`
		);
		await saveInitProgress(progress); // Save progress before starting the loop

		for (let i = 0; i < turnsToProcessThisRun.length; i++) {
			const turn = turnsToProcessThisRun[i];
			try {
				await processAndUpsertTurn(collection, turn, progress);
				await saveInitProgress(progress); // Save progress after each turn is successfully processed and upserted
			} catch (turnProcessingError) {
				// Error already logged and progress status updated in processAndUpsertTurn
				// If a CRITICAL DB error occurred, it would have been rethrown and caught by the outer catch block.
				// For LLM errors leading to fallback, processing continues.
				// If processAndUpsertTurn throws (e.g. on critical DB error), we stop this session.
				console.error(
					`  🛑 Halting processing for session "${TARGET_SESSION_ID}" due to critical error on turn ${turn.sequence}.`
				);
				break; // Stop processing more turns for THIS session
			}

			if (i < turnsToProcessThisRun.length - 1 && progress.status !== 'failed') {
				// Don't delay if session failed
				await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_LLM_CALLS_MS));
			}
		}

		// Final status update for the session
		if (progress.status !== 'failed') {
			// Only update to completed if not already marked as failed
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
	await cleanupCompletedProgress();
}

initChatFromLogFiles().catch((err) => {
	console.error('🚨🚨🚨 FATAL Unhandled error in initChatFromLogFiles outer scope:', err);
	process.exit(1); // Exit with error code
});

async function cleanupCompletedProgress(): Promise<void> {
	try {
		const files = await fs.readdir(PROGRESS_DIR);
		for (const file of files) {
			if (file.startsWith(PROGRESS_FILE_PREFIX) && file.endsWith('.json')) {
				const filePath = path.join(PROGRESS_DIR, file);
				try {
					const progressData = JSON.parse(await fs.readFile(filePath, 'utf-8')) as InitChatProgress;
					if (progressData.status === 'completed') {
						await fs.unlink(filePath);
						console.log(`🧹 Cleaned up completed progress file: ${file}`);
					}
				} catch (e) {
					console.warn(`⚠️ Could not read or parse progress file ${file} for cleanup:`, e);
				}
			}
		}
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
			// Ignore if progress dir doesn't exist
			console.warn('⚠️ Failed to cleanup progress files:', error);
		}
	}
}
