// scripts/chat/initChat.ts
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ChromaClient, Collection } from 'chromadb';
import { fileURLToPath } from 'node:url';
import { ChatMessage, ChatTurn, MigChatMessage } from '#shared/domain/chat/ChatInterfaces.js';
import {
	buildCharacterId,
	buildChatTurnId,
	buildMessageId,
	buildSessionId,
	buildProfileId,
} from '#shared/util/index.js';
import {
	parseChatTurnToMetadata,
	parseSessionId,
	parseTextToEntries,
} from '#shared/util/chatParseUtils.js';
import { COLLECTIONS } from '#server/db/ChromaInterfaces.js';
import { validEmotions } from '#shared/config/emotionWordsMapper.js';
import { METADATA_TYPES } from '#shared/config/constants.js';
import { chatStore } from '#server/store/chatStore.js';
import { buildChatTurnMetadataPrompt } from '#server/util/templateUtils.js';
import { mapTerms, termStore } from '#server/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configuration ---
const CRAWLER_RESULT_DIR = path.join(__dirname, 'result');
const EMOTION_DEFAULT = 'default';
const MAX_LLM_RETRIES = 3;
const USER_ID = process.env.USER_ID || '6b335673-c837-43f9-a1c7-0b92c90edefb';

const ENRICHMENT_MODEL = 'gemini-2.0-flash-001'; // Fast model for metadata extraction

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
let firstGeminiDone = false;
let secondGeminiDone = false; // Track if Groq fallback was used
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const generateEnrichedMetadataLLM = async (prompt: string, attempt = 1): Promise<string> => {
	// 이미 Groq 사용했다면 Gemini 재시도 금지
	if (secondGeminiDone) {
		console.warn(`    ✅ Already fell back to Groq. Skipping Gemini.`);
		return callGroqFallback(prompt); // 최종 결과
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
					generationConfig: { temperature: 0.3, maxOutputTokens: 1536 },
				}),
			}
		);

		if (!response.ok) {
			const errorBody = await response.text();
			console.warn(
				`    ⚠️ Gemini API non-OK response (Status ${response.status}): ${response.statusText}. Body: ${errorBody.substring(0, 200)}`
			);

			if (response.status === 429) {
				if (!firstGeminiDone) {
					console.warn(`    🚫 Gemini rate limited (429). Switching to second...`);
					firstGeminiDone = true;
					return generateEnrichedMetadataLLM(prompt, attempt + 1);
				}
				console.warn(`    🚫 Gemini rate limited (429). Switching to Groq...`);
				return callGroqFallback(prompt);
			}

			if (attempt < MAX_LLM_RETRIES) {
				const backoffTime = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
				console.warn(`    ↪️ Retrying Gemini in ${backoffTime / 1000}s...`);
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
			`    💥 Gemini LLM Error (Attempt ${attempt}/${MAX_LLM_RETRIES}):`,
			error instanceof Error ? error.message : String(error)
		);

		if (attempt >= MAX_LLM_RETRIES) {
			console.warn(`    🚨 Gemini failed after ${MAX_LLM_RETRIES} attempts. Switching to Groq...`);
			return generateEnrichedMetadataLLM(prompt, 1); // fallbackUsed = true
		}

		const backoffTime = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
		console.warn(`    ↪️ Retrying Gemini in ${backoffTime / 1000}s...`);
		await new Promise((resolve) => setTimeout(resolve, backoffTime));
		return generateEnrichedMetadataLLM(prompt, attempt + 1);
	}
};
const callGroqFallback = async (prompt: string, attempt = 1): Promise<string> => {
	if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY environment variable is required.');
	console.log(`    🔁 Fallback: Calling Groq (LLaMA3 70B), attempt ${attempt}`);
	if (!secondGeminiDone) {
		secondGeminiDone = true; // Set flag to prevent further Gemini calls
	}

	const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
		body: JSON.stringify({
			model: 'llama3-70b-8192',
			messages: [
				{ role: 'system', content: 'You are a helpful assistant.' },
				{ role: 'user', content: prompt },
			],
			temperature: 0.3,
			max_tokens: 1536,
		}),
	});

	if (res.status === 429) {
		const errorJson = await res.json();
		const match = errorJson?.error?.message?.match(/try again in ([\d.]+)s/i);
		const waitMs = match ? parseFloat(match[1]) * 1000 : 25000;

		console.warn(`    ⏳ Groq rate limited. Waiting ${waitMs / 1000}s before retrying...`);

		if (attempt >= 2) throw new Error(`Groq API rate limit (429) after retry.`);

		await new Promise((resolve) => setTimeout(resolve, waitMs));
		return callGroqFallback(prompt, attempt + 1); // retry once
	}

	if (!res.ok) {
		const errorText = await res.text();
		throw new Error(`Groq API Error ${res.status}: ${errorText}`);
	}

	const json = await res.json();
	const content = json.choices?.[0]?.message?.content;

	if (!content) {
		console.warn('    ⚠️ Empty content from Groq API:', JSON.stringify(json).substring(0, 500));
		throw new Error('Empty response content from Groq API');
	}

	console.log(`    🗣️ Groq API response received (length: ${content.length}).`);
	return content;
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
	existingLoreIds: string[] = [],
	existingHistoryIds: string[] = []
): Promise<ChatTurn> => {
	const prompt = buildChatTurnMetadataPrompt(
		{ showName: basicTurn.request.showName, name: 'yonyve', gender: 'female' },
		basicTurn.request,
		{ showName: basicTurn.response.showName, name: 'tarion', gender: 'male' },
		basicTurn.response,
		existingLoreIds,
		existingHistoryIds,
		termGuidanceMap
	);
	const llmResponse = await generateEnrichedMetadataLLM(prompt);
	const parsedLlmJson = extractJsonFromMarkdown(llmResponse);
	const defaults = getDefaultEnrichedMetadata();
	function defineEmotion(emotion: string, primary: string) {
		return primary && emotion === 'default' ? primary : emotion;
	}
	return {
		...basicTurn,
		request: {
			...basicTurn.request,
			emotion: defineEmotion(basicTurn.request.emotion, parsedLlmJson.userEmotion?.primary),
		},
		response: {
			...basicTurn.response,
			emotion: defineEmotion(basicTurn.response.emotion, parsedLlmJson.characterEmotion?.primary),
		},
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
async function processAndUpsertTurn(
	turnToProcess: ChatTurn,
	progress: InitChatProgress,
	termGuidanceMap: Map<string, string>,
	currentIndex: number,
	batchTotal: number
) {
	let enrichedTurnResult: ChatTurn;
	let wasEnrichedSuccessfully = false;

	try {
		console.log(
			`    🧠 [Batch ${currentIndex + 1}/${batchTotal}] Enriching turn with sequence: ${
				turnToProcess.sequence
			}...`
		);
		enrichedTurnResult = await enrichChatTurnWithMetadata(turnToProcess, termGuidanceMap);
		wasEnrichedSuccessfully = true;
		progress.successfullyEnrichedTurnsCount++;
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
		await chatStore._storeFullChatTurn(enrichedTurnResult);
		progress.lastProcessedSequence = enrichedTurnResult.sequence;
		console.log(
			`    ✅ [Batch ${
				currentIndex + 1
			}/${batchTotal}] Turn ${enrichedTurnResult.sequence} saved. Total processed for session: ${
				Number(progress.lastProcessedSequence) + 1
			}/${progress.totalTurnsInLogFile}`
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
			console.warn(`  ⚠️ Invalid log file name: "${logFile}". Skipping.`);
			continue;
		}
		const characterNameFromFile = fileNameParts[0];
		const characterId = buildCharacterId(characterNameFromFile, fileNameParts[1]);
		const TARGET_SESSION_ID = cliSessionId || buildSessionId(characterId);

		if (cliSessionId) {
			console.log(`\n📝 Using provided Session ID: "${cliSessionId}" for log file: "${logFile}"...`);
		} else {
			console.log(
				`\n📝 Processing log file: "${logFile}" for generated session ID: "${TARGET_SESSION_ID}"...`
			);
		}

		// --- The rest of the logic remains the same ---
		console.log(`  📚 Fetching glossary terms for session ${TARGET_SESSION_ID}...`);
		const termResponse = await termStore.getTermsBySessionId(TARGET_SESSION_ID);
		const termGuidanceMap = mapTerms(termResponse.terms);
		const { chatTurns: existingTurnsInDB } = await chatStore.getAllChatTurns(TARGET_SESSION_ID);
		const latestSequenceInDB =
			existingTurnsInDB.length > 0 ? Math.max(...existingTurnsInDB.map((t) => t.sequence)) : -1;
		console.log(
			`  🔍 DB Check: Found ${existingTurnsInDB.length} turns. Latest sequence is ${latestSequenceInDB}.`
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
						botLog.emotion && validEmotions.has(botLog.emotion) ? botLog.emotion : EMOTION_DEFAULT,
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
					`  Incomplete turn data for UUID "${uuid}" in session "${TARGET_SESSION_ID}". Skipping.`
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
			console.log(`  ✅ Session is up-to-date according to DB. No new turns to process.`);
			progress.status = 'completed'; // Mark as completed in the log
			await saveInitProgress(progress);
			continue;
		}

		console.log(
			`  📊 Found ${turnsToProcessThisRun.length} new turns to process, starting from sequence ${nextSequenceToProcess}.`
		);
		progress.status = 'in_progress';
		await saveInitProgress(progress);

		console.log(
			`  📊 Found ${turnsToProcessThisRun.length} new turns to process, starting from sequence ${nextSequenceToProcess}.`
		);
		progress.status = 'in_progress';
		await saveInitProgress(progress);

		for (const [i, turn] of turnsToProcessThisRun.entries()) {
			try {
				await processAndUpsertTurn(turn, progress, termGuidanceMap, i, turnsToProcessThisRun.length);
				await saveInitProgress(progress);
			} catch (turnProcessingError) {
				console.error(
					`  🛑 Halting processing for session "${TARGET_SESSION_ID}" due to critical error.`
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
