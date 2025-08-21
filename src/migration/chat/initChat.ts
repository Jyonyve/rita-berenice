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
	parseSessionId,
} from '#shared/util/index.js';
import { parseConversationToEntries } from '#server/util/chatParseUtils.js';
import { COLLECTIONS } from '#server/db/ChromaInterfaces.js';
import { DEFAULT_EMOTION, EmotionValue, validEmotions } from '#shared/config/emotionWordsMapper.js';
import { APPNAME, METADATA_TYPES, NA } from '#shared/config/constants.js';
import { chatStore } from '#server/store/chatStore.js';
import { buildChatTurnMetadataPrompt } from '#server/util/templateUtils.js';
import {
	flatSessionToDoc,
	mapHistoryContexts,
	mapLoreContexts,
	mapTerms,
	profileStore,
	termStore,
} from '#server/index.js';
import { createChatTurnMetadataSchema } from '#server/util/schemaUtils.js';
import { loreStore } from '#server/store/loreStore.js';
import { ChatGroq } from '@langchain/groq';
import { HistoryContext, LoreContext, SessionInfo, SessionMetadata } from '#shared/domain/index.js';
import { chromaDbClient } from '#server/db/chromaDbClient.js';
import {
	getMondayUserProfileTemplate,
	getTarionOriginalProfileTemplate,
	getTarionSpinoffProfileTemplate,
} from '../profile/initProfile.ts';
import { encoding_for_model } from 'tiktoken';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import { USER_ID } from '../userId.js';
import { getSessionTerms } from '../term/initTerm.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configuration ---
const CRAWLER_RESULT_DIR = path.join(__dirname, 'result');
const BACKUP_DIR = path.join(__dirname, 'backup');
const PROGRESS_DIR = path.join(__dirname, 'progress');
const PROGRESS_FILE_PREFIX = 'initchat-progress';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

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

const tokenizer = encoding_for_model('gpt-4');

// Helper function to calculate dynamic max tokens
function getDynamicMaxTokens(prompt: string, totalTokenLimit = 8192, minOutput = 2048): number {
	const promptTokens = tokenizer.encode(prompt).length;
	const availableForOutput = totalTokenLimit - promptTokens;
	return Math.max(minOutput, availableForOutput);
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

async function appendTurnToBackupFile(enrichedTurn: ChatTurn): Promise<void> {
	try {
		await fs.mkdir(BACKUP_DIR, { recursive: true });
		const { sessionId, sequence } = enrichedTurn;
		// The filename is now just the session ID with a .jsonl extension
		const filename = `${sessionId}.jsonl`;
		const filepath = path.join(BACKUP_DIR, filename);
		// Append the turn as a single line of JSON, followed by a newline
		const jsonLine = JSON.stringify(enrichedTurn) + '\n';
		await fs.appendFile(filepath, jsonLine);
		console.log(`     💾 Appended turn ${sequence} to backup: ${filename}`);
	} catch (error) {
		console.error(`     ⚠️ Failed to save backup for turn ${enrichedTurn.sequence}:`, error);
	}
}

const getDefaultEnrichedMetadata = () => ({
	summary: NA,
	keywords: [],
	topics: [],
	entities: [],
	userEmotion: { primary: DEFAULT_EMOTION, intensity: 0.5, nuanceList: [] },
	characterEmotion: { primary: DEFAULT_EMOTION, intensity: 0.5, nuanceList: [] },
	relationshipShifts: [],
	dialogueAct: NA,
	actions: [],
	loreReferenceList: [],
	historyReferenceList: [],
	flags: [],
	memoryChunk: NA,
});

function correctLLMResponse(
	rawResponse: any,
	loreContexts: LoreContext[],
	historyContexts: HistoryContext[]
): any {
	const existingLoreIds = loreContexts.map((l) => l.loreId);
	const existingHistoryIds = historyContexts.map((h) => h.historyId);

	// STUBBORN RULE 1: If no lore/history exists, force empty arrays
	if (existingLoreIds.length === 0) {
		console.log(`🔧 Application override: Forcing empty loreReferenceList (no lore available)`);
		rawResponse.loreReferenceList = [];
	} else {
		// Filter out invalid IDs that the LLM hallucinated
		const validLoreRefs =
			rawResponse.loreReferenceList?.filter((ref: any) => existingLoreIds.includes(ref.id)) || [];

		if (validLoreRefs.length !== rawResponse.loreReferenceList?.length) {
			console.log(`🔧 Application override: Filtered invalid lore references`);
			rawResponse.loreReferenceList = validLoreRefs;
		}
	}

	if (existingHistoryIds.length === 0) {
		console.log(`🔧 Application override: Forcing empty historyReferenceList (no history available)`);
		rawResponse.historyReferenceList = [];
	} else {
		const validHistoryRefs =
			rawResponse.historyReferenceList?.filter((ref: any) => existingHistoryIds.includes(ref.id)) ||
			[];

		if (validHistoryRefs.length !== rawResponse.historyReferenceList?.length) {
			console.log(`🔧 Application override: Filtered invalid history references`);
			rawResponse.historyReferenceList = validHistoryRefs;
		}
	}

	// STUBBORN RULE 2: Validate and correct other fields as needed
	if (!Array.isArray(rawResponse.keywordList)) {
		console.log(`🔧 Application override: Fixing non-array keywordList`);
		rawResponse.keywordList = [];
	}

	return rawResponse;
}

const enrichChatTurnWithMetadata = async (
	basicTurn: ChatTurn,
	termGuidanceMap: Map<string, string>,
	loreContexts: LoreContext[],
	historyContexts: HistoryContext[]
): Promise<ChatTurn> => {
	const chatTurnSchema = createChatTurnMetadataSchema(
		basicTurn.request.showName,
		basicTurn.response.showName
	);

	const prompt = buildChatTurnMetadataPrompt(
		{
			showName: basicTurn.request.showName,
			name: basicTurn.characterId.includes('tarion') ? 'yonyve' : 'jyonyve',
			gender: 'female',
		},
		basicTurn.request,
		{
			showName: basicTurn.response.showName,
			name: basicTurn.characterId.includes('tarion') ? 'tarion' : 'monday',
			gender: 'male',
		},
		basicTurn.response,
		loreContexts,
		historyContexts,
		termGuidanceMap
	);

	const maxTokens = getDynamicMaxTokens(prompt);
	let enrichedData: z.infer<typeof chatTurnSchema>;

	try {
		// --- 1. Attempt to use OpenRouter first ---
		console.log(
			`       📞 Calling OpenRouter (google/gemini-2.5-flash-lite) with schema enforcement...`
		);
		const openRouterClient = new ChatOpenAI({
			apiKey: OPENROUTER_API_KEY,
			model: 'google/gemini-2.5-flash-lite',
			temperature: 0.3,
			maxTokens,
			configuration: {
				baseURL: 'https://openrouter.ai/api/v1',
				defaultHeaders: {
					'HTTP-Referer': 'https://rita-berenice.fly.dev',
					'X-Title': APPNAME,
				},
			},
		});
		const structuredClient = openRouterClient.withStructuredOutput(chatTurnSchema);
		enrichedData = await structuredClient.invoke(prompt);
	} catch (openRouterError) {
		console.error(`       💥 OpenRouter failed:`, openRouterError);
		console.log(`       🔁 Falling back to direct Gemini...`);

		try {
			// --- 2. Fallback to direct Google Gemini ---
			const geminiClient = new ChatGoogleGenerativeAI({
				apiKey: GEMINI_API_KEY,
				model: 'gemini-2.0-flash',
				temperature: 0.3,
				maxOutputTokens: maxTokens,
			});
			const structuredGemini = geminiClient.withStructuredOutput(chatTurnSchema);
			enrichedData = await structuredGemini.invoke(prompt);
		} catch (geminiError) {
			console.error(`       💥 Direct Gemini also failed:`, geminiError);
			console.log(`       🔁 Falling back to Groq...`);

			// --- 3. Final fallback to Groq ---
			const groqClient = new ChatGroq({
				apiKey: GROQ_API_KEY,
				model: 'llama3-70b-8192',
				temperature: 0.3,
				maxTokens: maxTokens,
			});
			const structuredGroq = groqClient.withStructuredOutput(chatTurnSchema);
			enrichedData = await structuredGroq.invoke(prompt);
		}
	}

	// --- Data mapping (unchanged) ---
	const defineEmotion = (originalEmotion: string, newPrimaryEmotion: string): EmotionValue => {
		return originalEmotion && originalEmotion !== 'default'
			? (originalEmotion as EmotionValue)
			: (newPrimaryEmotion as EmotionValue);
	};
	const correctedResponse = correctLLMResponse(enrichedData, loreContexts, historyContexts);

	return {
		...basicTurn,
		request: {
			...basicTurn.request,
			emotion: defineEmotion(basicTurn.request.emotion, correctedResponse.userEmotion.primary),
		},
		response: {
			...basicTurn.response,
			emotion: defineEmotion(basicTurn.response.emotion, correctedResponse.characterEmotion.primary),
		},
		summary: correctedResponse.summary,
		memoryChunk: correctedResponse.memoryChunk,
		dialogueAct: correctedResponse.dialogueAct,
		keywordList: correctedResponse.keywordList,
		topicList: correctedResponse.topicList,
		entityList: correctedResponse.entityList,
		actionList: correctedResponse.actionList,
		flagList: correctedResponse.flagList,
		relationshipShiftList: correctedResponse.relationshipShiftList,
		userEmotion: {
			...correctedResponse.userEmotion,
			nuanceList: correctedResponse.userEmotion.nuanceList,
		},
		characterEmotion: {
			...correctedResponse.characterEmotion,
			nuanceList: correctedResponse.characterEmotion.nuanceList,
		},
		loreReferenceList: correctedResponse.loreReferenceList,
		historyReferenceList: correctedResponse.historyReferenceList,
		characterId: basicTurn.characterId || parseSessionId(basicTurn.sessionId).characterId,
		updatedAt: new Date().toISOString(),
	};
};

async function processAndUpsertTurn(
	turnToProcess: ChatTurn,
	progress: InitChatProgress,
	termGuidanceMap: Map<string, string>,
	loreContexts: LoreContext[],
	historyContexts: HistoryContext[],
	currentIndex: number,
	batchTotal: number
) {
	let enrichedTurn: ChatTurn;
	try {
		console.log(
			`       🧠 [Batch ${currentIndex + 1}/${batchTotal}] Enriching turn seq: ${
				turnToProcess.sequence
			}...`
		);
		enrichedTurn = await enrichChatTurnWithMetadata(
			turnToProcess,
			termGuidanceMap,
			loreContexts,
			historyContexts
		);
		progress.successfullyEnrichedTurnsCount++;
	} catch (enrichmentError) {
		const errorMessage =
			enrichmentError instanceof Error ? enrichmentError.message : String(enrichmentError);
		console.error(
			`       ❌ LLM Enrichment failed for turn ${turnToProcess.sequence}: ${errorMessage}`
		);
		progress.errors.push({
			sequence: turnToProcess.sequence,
			error: `Enrichment failed: ${errorMessage}`,
			timestamp: new Date().toISOString(),
		});
		enrichedTurn = {
			...turnToProcess,
			...getDefaultEnrichedMetadata(),
			characterId: turnToProcess.characterId || parseSessionId(turnToProcess.sessionId).characterId,
			updatedAt: new Date().toISOString(),
		};
		console.warn(`       ↪️ Using default (rich) metadata for turn ${turnToProcess.sequence}.`);
		progress.fallbackSavedTurnsCount++;
	}
	try {
		await appendTurnToBackupFile(enrichedTurn);
		await chatStore.storeChatTurn(enrichedTurn);

		progress.lastProcessedSequence = enrichedTurn.sequence;
		console.log(
			`       ✅ [Batch ${currentIndex + 1}/${batchTotal}] Turn ${
				enrichedTurn.sequence
			} and its indexes saved.`
		);
	} catch (dbError) {
		const dbErrorMessage = dbError instanceof Error ? dbError.message : String(dbError);
		console.error(
			`       💥 CRITICAL DB Error saving turn ${enrichedTurn.sequence}: ${dbErrorMessage}`
		);
		progress.errors.push({
			sequence: enrichedTurn.sequence,
			error: `DB Upsert failed: ${dbErrorMessage}`,
			timestamp: new Date().toISOString(),
		});
		progress.status = 'failed';
		await saveInitProgress(progress);
		throw new Error(`CRITICAL DB Error for turn ${enrichedTurn.sequence}: ${dbErrorMessage}`);
	}
}

async function initChatFromLogFiles() {
	console.log(`🚀 Starting chat initialization script...`);
	if (!GEMINI_API_KEY || !GROQ_API_KEY) {
		console.error('🚨 API keys not set. Aborting.');
		process.exit(1);
	}
	console.log(`Ensuring connection to ChromaDB...`);
	// Correctly check only for the collection managed by chatStore
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

		const fileContent = await fs.readFile(path.join(CRAWLER_RESULT_DIR, logFile), 'utf-8');
		const crawledLogs: MigChatMessage[] = JSON.parse(fileContent);

		if (crawledLogs.length === 0) {
			console.warn(`       ⚠️ Log file "${logFile}" is empty. Skipping.`);
			continue;
		}

		// update session
		const firstMessage = crawledLogs[0];
		const lastMessage = crawledLogs[crawledLogs.length - 1];
		const collection = await chromaDbClient.getSessionCollection();
		const sessionInfo: SessionInfo = {
			sessionId: TARGET_SESSION_ID,
			userId: USER_ID,
			profileId: buildProfileId(TARGET_SESSION_ID, USER_ID),
			characterId,
			title: `${lastMessage.showName} x ${firstMessage.showName}`,
			createdAt: firstMessage.createdAt,
			updatedAt: lastMessage.createdAt,
			messageCount: crawledLogs.length,
			status: 'active',
			type: METADATA_TYPES.SESSION,
			lastCharMessage: lastMessage.content,
		};
		const document = flatSessionToDoc(sessionInfo);
		const metadata: SessionMetadata = {
			sessionId: sessionInfo.sessionId,
			userId: sessionInfo.userId,
			profileId: sessionInfo.profileId,
			characterId: sessionInfo.characterId,
			title: sessionInfo.title,
			createdAt: sessionInfo.createdAt,
			updatedAt: sessionInfo.updatedAt,
			messageCount: sessionInfo.messageCount,
			status: sessionInfo.status,
			type: sessionInfo.type,
		};

		// Step 5: Upsert the record directly into the collection.
		console.log(`Upserting session with predefined ID: ${sessionInfo.sessionId}...`);
		await chromaDbClient.upsertRecord(collection, sessionInfo.sessionId, document, metadata);

		if (!cliSessionId) {
			// init term
			if (characterNameFromFile === 'tarion') {
				await profileStore.storeProfile(
					fileNameParts[1] === 'original'
						? getTarionOriginalProfileTemplate(USER_ID, TARGET_SESSION_ID)
						: getTarionSpinoffProfileTemplate(USER_ID, TARGET_SESSION_ID)
				);
				await termStore.storeSessionTerms(getSessionTerms(TARGET_SESSION_ID));
			} else {
				await profileStore.storeProfile(getMondayUserProfileTemplate(USER_ID, TARGET_SESSION_ID));
			}
		}

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

		const loreContexts = mapLoreContexts(loreRes.loreInfos);
		const historyContexts = mapHistoryContexts(historyRes.historyInfos);
		console.log(
			`      Found ${loreContexts.length} lore and ${historyContexts.length} history documents.`
		);

		const { displayTurns: existingTurnsInDB } = await chatStore.getAllDisplayTurns(TARGET_SESSION_ID);
		const latestSequenceInDB =
			existingTurnsInDB.length > 0 ? Math.max(...existingTurnsInDB.map((t) => t.sequence)) : -1;
		console.log(
			`     🔍 DB Check: Found ${existingTurnsInDB.length} turns. Latest sequence is ${latestSequenceInDB}.`
		);

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
					entries: parseConversationToEntries(userLog.content),
					emotion: DEFAULT_EMOTION,
					createdAt: userLog.createdAt,
					updatedAt: userLog.updatedAt || userLog.createdAt,
					showName: userLog.showName || '요니브',
					type: METADATA_TYPES.MESSAGE,
					sessionId: TARGET_SESSION_ID,
					sequence: currentSequence,
					model: 'none',
				};
				const responseMessage: ChatMessage = {
					role: 'assistant',
					messageId: buildMessageId(TARGET_SESSION_ID, currentSequence, 'response'),
					messageType: 'response',
					entries: parseConversationToEntries(botLog.content),
					emotion:
						botLog.emotion && validEmotions.has(botLog.emotion)
							? (botLog.emotion as EmotionValue)
							: DEFAULT_EMOTION,
					createdAt: botLog.createdAt,
					updatedAt: botLog.updatedAt || botLog.createdAt,
					model: botLog.model || 'none',
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
					createdAt: userLog.createdAt,
					characterId,
					updatedAt: new Date().toISOString(),
					...getDefaultEnrichedMetadata(),
					keywordList: [],
					topicList: [],
					entityList: [],
					actionList: [],
					flagList: [],
					relationshipShiftList: [],
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
					loreContexts,
					historyContexts,
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
					`🎉 Session "${TARGET_SESSION_ID}" fully completed! Processed ${
						progress.lastProcessedSequence + 1
					} turns.`
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
