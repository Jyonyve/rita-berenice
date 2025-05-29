// scripts/chat/initChat.ts

import fs from 'node:fs/promises';
import path, { parse } from 'node:path';
import { ChromaClient, Collection } from 'chromadb';
import { fileURLToPath } from 'node:url';
import {
	ChatMessage,
	ChatTurn,
	ChatTurnMetadata,
	MigChatMessage,
	COLLECTIONS,
	METADATA_TYPES,
} from '../../shared/domain/index.ts';
import {
	buildMessageId,
	buildSessionId,
	buildChatTurnId,
	buildCharacterId,
	buildChatTurnDocument,
	buildChatTurnMetadataPrompt,
} from '../../server/util/index.ts';
import {
	convertArrayToString,
	convertStringToArray,
	parseChatTurnToMetadata,
	parseTextToEntries,
} from '../../shared/util/index.ts';
import { validEmotions } from '../../shared/config/index.ts';

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
			const cleanedResponse = llmResponse.replace(/``````/g, '').trim();
			enrichedMetadata = JSON.parse(cleanedResponse);
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
async function upsertEnrichedInBatches(
	collection: Collection,
	turns: ChatTurn[],
	batchSize: number,
	sessionId: string
) {
	console.log(
		`    Starting enriched batched upsert for session "${sessionId}". Total turns: ${turns.length}, Batch size: ${batchSize}`
	);

	for (let i = 0; i < turns.length; i += batchSize) {
		const batchNumber = Math.floor(i / batchSize) + 1;
		const batchEnd = Math.min(i + batchSize, turns.length);
		console.log(
			`      Processing batch #${batchNumber} (indices ${i} to ${batchEnd - 1}) for session "${sessionId}"...`
		);

		const batchTurns = turns.slice(i, batchEnd);

		// Enrich each turn in the batch with LLM
		const enrichedTurns: ChatTurn[] = [];
		for (const turn of batchTurns) {
			const enrichedTurn = await enrichChatTurnWithMetadata(turn);
			enrichedTurns.push(enrichedTurn);

			// Delay between LLM calls to avoid rate limiting
			if (enrichedTurns.length < batchTurns.length) {
				await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_LLM_CALLS_MS));
			}
		}

		// Prepare data for ChromaDB
		const batchIds = enrichedTurns.map((turn) => turn.chatTurnId);
		const batchDocuments = enrichedTurns.map((turn) => buildChatTurnDocument(turn));
		const batchMetadatas = enrichedTurns.map((turn) => parseChatTurnToMetadata(turn));

		console.log(
			`      Attempting to upsert enriched batch #${batchNumber} (size: ${batchIds.length}) for session "${sessionId}"...`
		);
		try {
			await collection.upsert({ ids: batchIds, documents: batchDocuments, metadatas: batchMetadatas });
			console.log(
				`      ✅ Successfully upserted enriched batch #${batchNumber} for session "${sessionId}".`
			);
		} catch (batchError) {
			console.error(
				`      ❌ ERROR upserting enriched batch #${batchNumber} for session "${sessionId}":`,
				batchError
			);
			throw batchError;
		}

		if (batchEnd < turns.length) {
			console.log(`      Waiting ${DELAY_BETWEEN_BATCHES_MS}ms before next batch...`);
			await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
		}
	}
	console.log(`    ✅ Finished enriched batched upsert for session "${sessionId}".`);
}

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

			const filePath = path.join(CRAWLER_RESULT_DIR, logFile);
			console.log(`\n📝 Processing log file: "${logFile}" for session ID: "${TARGET_SESSION_ID}"...`);

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
				console.log(
					`  📊 Total ${basicTurns.length} turns prepared for enrichment and storage in session "${TARGET_SESSION_ID}".`
				);
				console.log(`  🧠 Starting LLM enrichment process...`);

				// Enrich and upsert in batches
				await upsertEnrichedInBatches(collection, basicTurns, UPSERT_BATCH_SIZE, TARGET_SESSION_ID);

				console.log(
					`  ✅ Successfully processed and stored all enriched chat turns for session "${TARGET_SESSION_ID}".`
				);
			} else {
				console.log(`  ⚠️ No complete chat turns were processed for session "${TARGET_SESSION_ID}".`);
			}
		}

		console.log('\n🎉 Chat initialization with LLM enrichment completed successfully!');
	} catch (error) {
		console.error('❌ Error during enriched chat initialization:', error);
		process.exit(1);
	}
}

initChatFromLogFiles();
