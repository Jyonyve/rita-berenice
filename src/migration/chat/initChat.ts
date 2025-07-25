// scripts/chat/initChat.ts
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { ChatMessage, ChatTurn, MigChatMessage } from '#shared/domain/chat/ChatInterfaces.js';
import {
	buildCharacterId,
	buildChatTurnId,
	buildMessageId,
	buildSessionId,
	buildProfileId,
} from '#shared/util/index.js';
import { parseSessionId, parseTextToEntries } from '#shared/util/chatParseUtils.js';
import { COLLECTIONS } from '#server/db/ChromaInterfaces.js';
import { EmotionValue, validEmotions } from '#shared/config/emotionWordsMapper.js';
import { METADATA_TYPES } from '#shared/config/constants.js';
import { chatStore } from '#server/store/chatStore.js';
import { buildChatTurnMetadataPrompt } from '#server/util/templateUtils.js';
import { mapTerms, termStore } from '#server/index.js';
import { createChatTurnMetadataSchema } from '#server/util/schemaUtils.js';
import { loreStore } from '#server/store/loreStore.js';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatGroq } from '@langchain/groq';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configuration ---
const CRAWLER_RESULT_DIR = path.join(__dirname, 'result');
const EMOTION_DEFAULT: EmotionValue = 'neutral';
const MAX_LLM_RETRIES = 3;
const USER_ID = process.env.USER_ID || '6b335673-c837-43f9-a1c7-0b92c90edefb';
const ENRICHMENT_MODEL = 'gemini-1.5-flash-latest'; // Fast model for metadata extraction
const PROGRESS_DIR = path.join(__dirname, 'progress');
const PROGRESS_FILE_PREFIX = 'initchat-progress';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// --- Progress Tracking Interfaces and Functions ---
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
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
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
	termGuidanceMap: Map<string, string>,
	existingLoreIds: string[],
	existingHistoryIds: string[]
): Promise<ChatTurn> => {
	// --- Create the dynamic Zod schema using your existing factory ---
	const chatTurnSchema = createChatTurnMetadataSchema(
		basicTurn.request.showName,
		basicTurn.response.showName,
		existingLoreIds,
		existingHistoryIds
	);

	// --- Create the prompt for the LLM ---
	const prompt = buildChatTurnMetadataPrompt(
		{ showName: basicTurn.request.showName, name: 'yonyve', gender: 'female' },
		basicTurn.request,
		{ showName: basicTurn.response.showName, name: 'tarion', gender: 'male' },
		basicTurn.response,
		termGuidanceMap
	);

	let enrichedData: z.infer<typeof chatTurnSchema>;

	try {
		// --- Attempt to use Gemini first ---
		console.log(`      📞 Calling Gemini via LangChain with schema enforcement...`);
		const geminiClient = new ChatGoogleGenerativeAI({
			apiKey: process.env.GEMINI_API_KEY,
			model: 'gemini-1.5-flash-latest',
			temperature: 0.3,
			maxOutputTokens: 2048,
		});

		const structuredGemini = geminiClient.withStructuredOutput(chatTurnSchema);
		enrichedData = await structuredGemini.invoke(prompt);
	} catch (geminiError) {
		console.error(`      💥 Gemini (LangChain) failed:`, geminiError);
		console.log(`      🔁 Falling back to Groq...`);

		// --- Fallback to Groq on Gemini failure ---
		const groqClient = new ChatGroq({
			apiKey: process.env.GROQ_API_KEY,
			model: 'llama3-70b-8192',
			temperature: 0.3,
			maxTokens: 2048,
		});

		const structuredGroq = groqClient.withStructuredOutput(chatTurnSchema);
		enrichedData = await structuredGroq.invoke(prompt);
	}

	// --- The rest of the function now uses the guaranteed clean data ---
	const defineEmotion = (originalEmotion: string, newPrimaryEmotion: string): EmotionValue => {
		return originalEmotion && originalEmotion !== 'neutral'
			? (originalEmotion as EmotionValue)
			: (newPrimaryEmotion as EmotionValue);
	};

	return {
		...basicTurn,
		request: {
			...basicTurn.request,
			emotion: defineEmotion(basicTurn.request.emotion, enrichedData.userEmotion.primary),
		},
		response: {
			...basicTurn.response,
			emotion: defineEmotion(basicTurn.response.emotion, enrichedData.characterEmotion.primary),
		},
		// Directly spread the validated data
		...enrichedData,
		characterId: basicTurn.characterId || parseSessionId(basicTurn.sessionId).characterId,
		updatedAt: new Date().toISOString(),
	};
};

async function processAndUpsertTurn(
	turnToProcess: ChatTurn,
	progress: InitChatProgress,
	termGuidanceMap: Map<string, string>,
	existingLoreIds: string[],
	existingHistoryIds: string[],
	currentIndex: number,
	batchTotal: number
) {
	let enrichedTurnResult: ChatTurn;
	try {
		console.log(
			`      🧠 [Batch ${currentIndex + 1}/${batchTotal}] Enriching turn with sequence: ${turnToProcess.sequence}...`
		);
		enrichedTurnResult = await enrichChatTurnWithMetadata(
			turnToProcess,
			termGuidanceMap,
			existingLoreIds,
			existingHistoryIds
		);
		progress.successfullyEnrichedTurnsCount++;
	} catch (enrichmentError) {
		const errorMessage =
			enrichmentError instanceof Error ? enrichmentError.message : String(enrichmentError);
		console.error(
			`      ❌ LLM Enrichment failed for turn ${turnToProcess.sequence}: ${errorMessage}`
		);
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
		console.warn(`      ↪️ Using default (rich) metadata for turn ${turnToProcess.sequence}.`);
		progress.fallbackSavedTurnsCount++;
	}
	try {
		await chatStore._storeFullChatTurn(enrichedTurnResult);
		progress.lastProcessedSequence = enrichedTurnResult.sequence;
		console.log(
			`      ✅ [Batch ${currentIndex + 1}/${batchTotal}] Turn ${enrichedTurnResult.sequence} saved.`
		);
	} catch (dbError) {
		const dbErrorMessage = dbError instanceof Error ? dbError.message : String(dbError);
		console.error(
			`      💥 CRITICAL DB Error saving turn ${enrichedTurnResult.sequence}: ${dbErrorMessage}`
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

async function initChatFromLogFiles() {
	console.log(`🚀 Starting chat initialization script...`);
	if (!GEMINI_API_KEY || !GROQ_API_KEY) {
		console.error('🚨 GEMINI_API_KEY or GROQ_API_KEY is not set in environment variables. Aborting.');
		process.exit(1);
	}
	console.log(`Ensuring connection to ChromaDB...`);
	await chatStore._getChatCollection();
	console.log(`Collection "${COLLECTIONS.CHAT}" is ready.`);
	const allLogFiles = (await fs.readdir(CRAWLER_RESULT_DIR)).filter((file) =>
		file.endsWith('.json')
	);
	console.log(`Found ${allLogFiles.length} log files to process.`);
	const cliSessionId = process.argv[2];

	for (const logFile of allLogFiles) {
		const fileNameParts = path.basename(logFile, '.json').split('_');
		if (fileNameParts.length < 2) {
			console.warn(`      ⚠️ Invalid log file name: "${logFile}". Skipping.`);
			continue;
		}
		const characterNameFromFile = fileNameParts[0];
		const characterId = cliSessionId
			? parseSessionId(cliSessionId).characterId
			: buildCharacterId(characterNameFromFile, fileNameParts[1]);
		const TARGET_SESSION_ID = cliSessionId || buildSessionId(characterId);

		console.log(
			cliSessionId
				? `\n📝 Using provided Session ID: "${cliSessionId}" for log file: "${logFile}"...`
				: `\n📝 Processing log file: "${logFile}" for generated session ID: "${TARGET_SESSION_ID}"...`
		);

		console.log(`      📚 Fetching glossary terms for session ${TARGET_SESSION_ID}...`);
		const termResponse = await termStore.getTermsBySessionId(TARGET_SESSION_ID);
		const termGuidanceMap = mapTerms(termResponse.terms);

		console.log(`      Fetching existing lore and history for character ${characterId}...`);
		const [loreRes, historyRes] = await Promise.all([
			loreStore.getLores(characterId),
			loreStore.getHistories(characterId),
		]);
		const existingLoreIds = loreRes.loreInfos.map((lore) => lore.loreId);
		const existingHistoryIds = historyRes.historyInfos.map((history) => history.historyId);
		console.log(
			`      Found ${existingLoreIds.length} lore and ${existingHistoryIds.length} history documents.`
		);

		const { chatTurns: existingTurnsInDB } = await chatStore.getAllChatTurns(TARGET_SESSION_ID);
		const latestSequenceInDB =
			existingTurnsInDB.length > 0 ? Math.max(...existingTurnsInDB.map((t) => t.sequence)) : -1;
		console.log(
			`      🔍 DB Check: Found ${existingTurnsInDB.length} turns. Latest sequence is ${latestSequenceInDB}.`
		);

		const fileContent = await fs.readFile(path.join(CRAWLER_RESULT_DIR, logFile), 'utf-8');
		const crawledLogs: MigChatMessage[] = JSON.parse(fileContent);
		const basicTurnsFromLog: ChatTurn[] = [];
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

		for (const uuid of sortedUuids) {
			const turnPair = turnsMap.get(uuid);
			if (turnPair?.user && turnPair?.bot) {
				const [userLog, botLog] = [turnPair.user, turnPair.bot];
				const currentSequence = userLog.index;
				if (currentSequence === undefined) continue;

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
						botLog.emotion && validEmotions.has(botLog.emotion)
							? (botLog.emotion as EmotionValue)
							: EMOTION_DEFAULT,
					createdAt: botLog.createdAt,
					updatedAt: botLog.updatedAt || botLog.createdAt,
					model: botLog.model,
					sessionId: TARGET_SESSION_ID,
					showName: botLog.showName,
					type: METADATA_TYPES.MESSAGE,
					sequence: currentSequence,
				};
				const basicTurn: ChatTurn = {
					sessionId: TARGET_SESSION_ID,
					userId: USER_ID,
					profileId: buildProfileId(TARGET_SESSION_ID, USER_ID),
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
					`      Incomplete turn data for UUID "${uuid}" in session "${TARGET_SESSION_ID}". Skipping.`
				);
			}
		}

		let progress = await loadInitProgress(TARGET_SESSION_ID);
		if (!progress) {
			progress = createInitialProgress(TARGET_SESSION_ID, basicTurnsFromLog.length);
		} else {
			progress.totalTurnsInLogFile = basicTurnsFromLog.length;
		}

		const nextSequenceToProcess = latestSequenceInDB + 1;
		const turnsToProcessThisRun = basicTurnsFromLog
			.filter((turn) => turn.sequence >= nextSequenceToProcess)
			.sort((a, b) => a.sequence - b.sequence);

		if (turnsToProcessThisRun.length === 0) {
			console.log(`      ✅ Session is up-to-date according to DB. No new turns to process.`);
			progress.status = 'completed';
			await saveInitProgress(progress);
			continue;
		}

		console.log(
			`      📊 Found ${turnsToProcessThisRun.length} new turns to process, starting from sequence ${nextSequenceToProcess}.`
		);
		progress.status = 'in_progress';
		await saveInitProgress(progress);

		for (const [i, turn] of turnsToProcessThisRun.entries()) {
			try {
				await processAndUpsertTurn(
					turn,
					progress,
					termGuidanceMap,
					existingLoreIds,
					existingHistoryIds,
					i,
					turnsToProcessThisRun.length
				);
				await saveInitProgress(progress);
			} catch (turnProcessingError) {
				console.error(
					`      🛑 Halting processing for session "${TARGET_SESSION_ID}" due to critical error.`
				);
				progress.status = 'failed';
				await saveInitProgress(progress);
				break;
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
}

initChatFromLogFiles().catch((err) => {
	console.error('🚨🚨🚨 FATAL SCRIPT ERROR:', err);
	process.exit(1);
});
