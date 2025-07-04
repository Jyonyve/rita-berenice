// scripts/linkChatToHistory.ts
import { ratio, partial_ratio, token_sort_ratio } from 'fuzzball';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ChromaClient, Collection, IncludeEnum, Where } from 'chromadb';
import { fileURLToPath } from 'node:url';

import {
	ChatTurnMetadata,
	convertStringToArray,
	HistoryMetadata,
	METADATA_TYPES,
} from '#shared/index.js';
import { chatStore, COLLECTIONS, loreStore } from '#server/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHROMA_URL = process.env.CHROMA_API_URL || 'https://chromadb-flyio.fly.dev';
// --- Threshold Configuration ---
const OVERALL_SIMILARITY_THRESHOLD = 0.25; // Main threshold for a turn-history pair to be considered relevant
const INDIVIDUAL_TERM_MATCH_MIN_SCORE = 60; // Min score (0-100) for a keyword/entity/topic pair to count as a match
const SUMMARY_FALLBACK_MIN_SCORE = 75; // Min score (0-100) for summary/title match to trigger fallback
const SUMMARY_FALLBACK_BOOST = 0.1; // How much to boost the score if summary fallback is triggered

const MAX_HISTORY_REFS_PER_TURN = 3;

// Progress tracking configuration (same as before)
// --- Directory Configuration ---
const SCRIPT_OUTPUT_DIR = path.join(__dirname, 'linkoutput'); // For logs and backups
const PROGRESS_DIR = path.join(SCRIPT_OUTPUT_DIR, 'progress'); // Progress files nested under output
const PROGRESS_FILE_PREFIX = 'link-chat-history-progress';
const BATCH_SIZE = 20;

// ✅ --- Console Log to File Setup ---
let logFileStream: fs.FileHandle | null = null;
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

const setupFileLogger = async (logFilePath: string) => {
	try {
		await fs.mkdir(path.dirname(logFilePath), { recursive: true });
		logFileStream = await fs.open(logFilePath, 'a'); // Open in append mode

		const writeToStream = (message: string) => {
			if (logFileStream) {
				logFileStream.write(message + '\n').catch(console.error);
			}
		};

		console.log = (...args: any[]) => {
			originalConsoleLog.apply(console, args);
			writeToStream(
				args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ')
			);
		};
		console.warn = (...args: any[]) => {
			originalConsoleWarn.apply(console, args);
			writeToStream(
				`WARN: ${args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ')}`
			);
		};
		console.error = (...args: any[]) => {
			originalConsoleError.apply(console, args);
			writeToStream(
				`ERROR: ${args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ')}`
			);
		};
		console.log(`📝 Console output is also being logged to: ${logFilePath}`);
	} catch (err) {
		originalConsoleError('🚨 Failed to setup file logger:', err);
	}
};

const closeFileLogger = async () => {
	if (logFileStream) {
		await logFileStream.close();
		logFileStream = null;
		console.log = originalConsoleLog; // Restore original console functions
		console.warn = originalConsoleWarn;
		console.error = originalConsoleError;
		originalConsoleLog('🚪 File logger closed.'); // Use original log after restoring
	}
};
// --- End Console Log to File Setup ---

// ✅ Progress tracking interface
interface LinkingProgress {
	processId: string;
	totalChatTurns: number;
	processedChatTurns: number;
	lastProcessedChatTurnId: string;
	totalHistoryEvents: number;
	updatedChatTurns: number;
	totalReferencesAdded: number;
	startedAt: string;
	lastUpdatedAt: string;
	status: 'in_progress' | 'completed' | 'failed' | 'paused';
	currentBatch: number;
	totalBatches: number;
	errors: Array<{ chatTurnId: string; error: string; timestamp: string }>;
	statistics: {
		averageRelevanceScore: number;
		highestRelevanceScore: number;
		chatTurnsWithNoMatches: number;
		chatTurnsAlreadyLinked: number;
	};
}

// ✅ Progress tracking helper functions
const getProgressFilePath = (processId: string): string => {
	return path.join(PROGRESS_DIR, `${PROGRESS_FILE_PREFIX}-${processId}.json`);
};

const loadLinkingProgress = async (processId: string): Promise<LinkingProgress | null> => {
	try {
		await fs.mkdir(PROGRESS_DIR, { recursive: true });
		const progressFile = getProgressFilePath(processId);
		const data = await fs.readFile(progressFile, 'utf-8');
		return JSON.parse(data);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return null;
		}
		console.warn(`Warning: Could not load progress file for ${processId}:`, error);
		return null;
	}
};

const saveLinkingProgress = async (progress: LinkingProgress): Promise<void> => {
	progress.lastUpdatedAt = new Date().toISOString();
	try {
		await fs.mkdir(PROGRESS_DIR, { recursive: true });
		const progressFile = getProgressFilePath(progress.processId);
		await fs.writeFile(progressFile, JSON.stringify(progress, null, 2));
	} catch (error) {
		console.error(`Failed to save progress for process ${progress.processId}:`, error);
	}
};

const createInitialProgress = (
	processId: string,
	totalChatTurns: number,
	totalHistoryEvents: number
): LinkingProgress => {
	const totalBatches = Math.ceil(totalChatTurns / BATCH_SIZE);
	return {
		processId,
		totalChatTurns,
		processedChatTurns: 0,
		lastProcessedChatTurnId: '',
		totalHistoryEvents,
		updatedChatTurns: 0,
		totalReferencesAdded: 0,
		startedAt: new Date().toISOString(),
		lastUpdatedAt: new Date().toISOString(),
		status: 'in_progress',
		currentBatch: 0,
		totalBatches,
		errors: [],
		statistics: {
			averageRelevanceScore: 0,
			highestRelevanceScore: 0,
			chatTurnsWithNoMatches: 0,
			chatTurnsAlreadyLinked: 0,
		},
	};
};

// ✅ Relevance calculation (same as before)
interface RelevanceScore {
	historyId: string;
	score: number; // Normalized score (0-1)
	matchedKeywords: string[];
	matchedEntities: string[];
	matchedTopics: string[];
	matchType: 'metadata' | 'summary_fallback';
}

// calculateEnhancedSimilarity returns a score from 0-100
const calculateEnhancedSimilarity = (keyword1: string, keyword2: string): number => {
	const k1Lower = keyword1.toLowerCase();
	const k2Lower = keyword2.toLowerCase();
	if (!k1Lower || !k2Lower) return 0; // Avoid errors with empty strings

	if (k1Lower === k2Lower) return 100;
	if (k1Lower.includes(k2Lower) || k2Lower.includes(k1Lower)) return 90;

	const exactRatio = ratio(k1Lower, k2Lower);
	const partialRatio = partial_ratio(k1Lower, k2Lower);
	const tokenRatio = token_sort_ratio(k1Lower, k2Lower);

	return Math.max(exactRatio, partialRatio, tokenRatio);
};

const calculateRelevance = (
	chatMetadata: ChatTurnMetadata,
	historyMetadata: HistoryMetadata
): RelevanceScore => {
	const chatKeywords = convertStringToArray(chatMetadata.keywords);
	const chatEntities = convertStringToArray(chatMetadata.entities);
	const chatTopics = convertStringToArray(chatMetadata.topics);
	const chatSummary = chatMetadata.summary || '';

	const historyKeywords = convertStringToArray(historyMetadata.keywords);
	const historyEntities = convertStringToArray(historyMetadata.entities);
	const historyTopics = convertStringToArray(historyMetadata.topics);
	const historyTitle = historyMetadata.title || '';
	const historyGeneratedTitle = historyMetadata.generatedTitle || '';

	// --- Metadata-based matching ---
	const matchedKeywords = chatKeywords.filter((k) =>
		historyKeywords.some(
			(hk) => calculateEnhancedSimilarity(k, hk) >= INDIVIDUAL_TERM_MATCH_MIN_SCORE
		)
	);
	const matchedEntities = chatEntities.filter((e) =>
		historyEntities.some(
			(he) => calculateEnhancedSimilarity(e, he) >= INDIVIDUAL_TERM_MATCH_MIN_SCORE
		)
	);
	const matchedTopics = chatTopics.filter((t) =>
		historyTopics.some((ht) => calculateEnhancedSimilarity(t, ht) >= INDIVIDUAL_TERM_MATCH_MIN_SCORE)
	);

	const characterMatch =
		chatMetadata.characterId === historyMetadata.characterId ||
		(historyMetadata.ownerCharacterIds || '').includes(chatMetadata.characterId) ||
		(historyMetadata.sideCharacterIds || '').includes(chatMetadata.characterId) ||
		(historyMetadata.allAffectedCharacterIds || '').includes(chatMetadata.characterId);

	let metadataScore = 0;
	metadataScore += matchedKeywords.length * 0.4;
	metadataScore += matchedEntities.length * 0.3;
	metadataScore += matchedTopics.length * 0.2;
	metadataScore += characterMatch ? 0.1 : 0;

	const totalPossible = Math.max(chatKeywords.length + chatEntities.length + chatTopics.length, 1);
	let normalizedMetadataScore = metadataScore / totalPossible;

	let finalScore = normalizedMetadataScore;
	let matchType: 'metadata' | 'summary_fallback' = 'metadata';

	// --- Summary Fallback Logic ---
	if (normalizedMetadataScore < OVERALL_SIMILARITY_THRESHOLD) {
		const summaryToTitleScore = calculateEnhancedSimilarity(chatSummary, historyTitle);
		const summaryToGeneratedTitleScore = calculateEnhancedSimilarity(
			chatSummary,
			historyGeneratedTitle
		);
		const bestSummaryScore = Math.max(summaryToTitleScore, summaryToGeneratedTitleScore);

		if (bestSummaryScore >= SUMMARY_FALLBACK_MIN_SCORE) {
			// If summary match is good, boost the score slightly above the threshold
			// or use a blended approach. For now, let's use a boost.
			finalScore = Math.min(
				1,
				OVERALL_SIMILARITY_THRESHOLD + SUMMARY_FALLBACK_BOOST + bestSummaryScore / 1000
			); // Add a small part of summary score
			matchType = 'summary_fallback';
			console.log(
				`    🔄 Summary Fallback triggered for history '${historyMetadata.title}'! Chat summary: "${chatSummary.substring(0, 50)}...", History title: "${historyTitle}", Score: ${bestSummaryScore}, Final Score: ${finalScore.toFixed(3)}`
			);
		}
	}
	// Debugging for a small percentage of cases
	if (Math.random() < 0.005) {
		// Log 0.5% of comparisons
		console.log(
			`[DEBUG] Relevance for ChatTurn: ${chatMetadata.chatTurnId?.substring(0, 20)} | History: ${historyMetadata.historyId?.substring(0, 20)}`
		);
		console.log(
			`    Meta Score: ${normalizedMetadataScore.toFixed(3)}, Final Score: ${finalScore.toFixed(3)}, Match Type: ${matchType}`
		);
		console.log(
			`    Keywords: Chat(${chatKeywords.length}) Hist(${historyKeywords.length}) Matched(${matchedKeywords.length})`
		);
		console.log(
			`    Entities: Chat(${chatEntities.length}) Hist(${historyEntities.length}) Matched(${matchedEntities.length})`
		);
		console.log(
			`    Topics:   Chat(${chatTopics.length}) Hist(${historyTopics.length}) Matched(${matchedTopics.length})`
		);
		console.log(`    Char Match: ${characterMatch}`);
	}

	return {
		historyId: historyMetadata.historyId,
		score: finalScore, // Return the potentially boosted score
		matchedKeywords,
		matchedEntities,
		matchedTopics,
		matchType,
	};
};

// ✅ Main linking function with progress tracking
async function linkChatToHistory() {
	// ✅ Generate processId and setup logger AT THE START
	const processId = `link_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	const logFilePath = path.join(SCRIPT_OUTPUT_DIR, `link-chat-history-run-${processId}.txt`);
	await setupFileLogger(logFilePath);

	console.log('🔗 Starting chat-to-history linking process with progress tracking...');
	console.log(`📋 Process ID: ${processId}`);

	const chroma = new ChromaClient({ path: CHROMA_URL });
	let chatCollection: Collection;
	let loreCollection: Collection;

	try {
		chatCollection = await chatStore._getChatCollection();
		loreCollection = await loreStore._getCollection();
		console.log('✅ Connected to both chat and lore collections');
	} catch (error) {
		console.error('🚨 Failed to connect to collections:', error);
		process.exit(1);
	}

	try {
		// ✅ Check for existing progress
		let progress = await loadLinkingProgress(processId);

		// Step 1: Fetch all history events
		console.log('\n📚 Fetching all history events...');
		const historyWhere: Where = { type: { $eq: METADATA_TYPES.HISTORY } };
		const historyResults = await loreCollection.get({
			where: historyWhere,
			include: [IncludeEnum.metadatas],
		});
		if (!historyResults.metadatas || historyResults.metadatas.length === 0) {
			console.log('📝 No history events found. Nothing to link.');
			return;
		}

		const historyEvents = historyResults.metadatas as unknown as HistoryMetadata[];
		console.log(`📖 Found ${historyEvents.length} history events`);

		// Step 2: Fetch all chat turns
		console.log('\n💬 Fetching all chat turns...');
		const chatWhere: Where = {
			$and: [
				{ type: { $eq: METADATA_TYPES.TURN } },
				{
					characterId: {
						$in: historyEvents.flatMap((his) => convertStringToArray(his.ownerCharacterIds)),
					},
				},
			],
		}; // Ensure we only process turns with a character ID]};
		const chatResults = await chatCollection.get({
			where: chatWhere,
			include: [IncludeEnum.metadatas, IncludeEnum.documents],
		});

		if (!chatResults.metadatas || chatResults.metadatas.length === 0) {
			console.log('📝 No chat turns found. Nothing to process.');
			return;
		}

		const allChatTurns = chatResults.metadatas as unknown as ChatTurnMetadata[];
		console.log(`💭 Found ${allChatTurns.length} chat turns`);

		// ✅ Initialize or resume progress
		if (!progress) {
			progress = createInitialProgress(processId, allChatTurns.length, historyEvents.length);
			await saveLinkingProgress(progress);
			console.log(`📊 Initialized new progress tracking (${progress.totalBatches} batches)`);
		} else {
			console.log(
				`📊 Resuming from previous progress: ${progress.processedChatTurns}/${progress.totalChatTurns} processed`
			);
		}

		// ✅ Filter chat turns to process (skip already processed)
		const chatTurnsToProcess = allChatTurns.slice(progress.processedChatTurns);
		if (chatTurnsToProcess.length === 0) {
			/* ... same as before ... */ console.log('✅ All chat turns already processed!');
			progress.status = 'completed';
			await saveLinkingProgress(progress);
			return;
		}
		console.log(`🔄 Processing ${chatTurnsToProcess.length} remaining chat turns...`);
		// ✅ Process in batches with progress tracking
		const batches = [];
		for (let i = 0; i < chatTurnsToProcess.length; i += BATCH_SIZE) {
			batches.push(chatTurnsToProcess.slice(i, i + BATCH_SIZE));
		}
		let allRelevanceScores: number[] = [];

		for (const [batchIndex, batch] of batches.entries()) {
			const startingTurnIndex = progress.processedChatTurns + batchIndex * BATCH_SIZE; // This should be used to calculate currentBatchNumber correctly based on original full list
			const currentBatchNumber = Math.floor(startingTurnIndex / BATCH_SIZE) + 1;

			console.log(
				`\n📦 Processing batch ${currentBatchNumber}/${progress.totalBatches} (${batch.length} chat turns)`
			);
			progress.currentBatch = currentBatchNumber;
			await saveLinkingProgress(progress);

			for (const [turnIndexInBatch, chatTurnMetadata] of batch.entries()) {
				const globalIndex = progress.processedChatTurns; // This is the index in allChatTurns we are about to process

				try {
					console.log(
						`🔍 Processing turn ${globalIndex + 1}/${progress.totalChatTurns}: ${chatTurnMetadata.chatTurnId}`
					);

					// Skip if already has history references
					// const existingRefs = chatTurnMetadata.historyReferences
					// 	? JSON.parse(chatTurnMetadata.historyReferences)
					// 	: [];
					// if (existingRefs.length > 0) {
					// 	console.log(`  ⏭️ Already has ${existingRefs.length} history references, skipping`);
					// 	progress.statistics.chatTurnsAlreadyLinked++;
					// 	progress.processedChatTurns++;
					// 	progress.lastProcessedChatTurnId = chatTurnMetadata.chatTurnId;
					// 	continue;
					// }

					// Calculate relevance scores
					const relevanceScores: RelevanceScore[] = [];
					for (const historyEvent of historyEvents) {
						const relevance = calculateRelevance(chatTurnMetadata, historyEvent);
						// Debug printout for ALL candidates
						if (relevance.score > 0.01) {
							// Only print if there's *some* minimal score
							console.log(
								`    Candidate: ${historyEvent.title} [${historyEvent.historyId}] score: ${relevance.score.toFixed(3)} (Type: ${relevance.matchType})`
							);
						}
						if (relevance.score >= OVERALL_SIMILARITY_THRESHOLD) {
							// Use the main threshold here
							relevanceScores.push(relevance);
							allRelevanceScores.push(relevance.score);
						}
					}

					// Sort and take top matches
					relevanceScores.sort((a, b) => b.score - a.score);
					const topMatches = relevanceScores.slice(0, MAX_HISTORY_REFS_PER_TURN);

					if (topMatches.length > 0) {
						console.log(
							`  🎯 Found ${topMatches.length} relevant history events (Best score: ${topMatches[0].score.toFixed(3)}, Type: ${topMatches[0].matchType})`
						);

						const historyReferences = topMatches.map((match) => ({
							id: match.historyId,
							relevance: Math.round(match.score * 100) / 100,
						}));
						const highestScore = topMatches[0].score;
						if (highestScore > progress.statistics.highestRelevanceScore) {
							progress.statistics.highestRelevanceScore = highestScore;
						}
						const originalDocumentIndex = allChatTurns.findIndex(
							(ct) => ct.chatTurnId === chatTurnMetadata.chatTurnId
						);
						const updatedChatTurn: ChatTurnMetadata = {
							...chatTurnMetadata,
							historyReferences: JSON.stringify(historyReferences),
							updatedAt: new Date().toISOString(),
						};
						await chatCollection.upsert({
							ids: [chatTurnMetadata.chatTurnId],
							documents: [chatResults.documents![originalDocumentIndex]!], // Assuming originalDocumentIndex is calculated
							metadatas: [updatedChatTurn as any],
						});
						progress.updatedChatTurns++;
						progress.totalReferencesAdded += historyReferences.length;
						console.log(`  ✅ Updated with ${historyReferences.length} history references`);
					} else {
						console.log(
							`  📝 No relevant history events found (threshold: ${OVERALL_SIMILARITY_THRESHOLD})`
						);
						progress.statistics.chatTurnsWithNoMatches++;
					}

					progress.processedChatTurns++; // Increment after processing each turn
					progress.lastProcessedChatTurnId = chatTurnMetadata.chatTurnId;
				} catch (error) {
					console.error(`  ❌ Error processing chat turn ${chatTurnMetadata.chatTurnId}:`, error);
					progress.errors.push({
						chatTurnId: chatTurnMetadata.chatTurnId,
						error: error instanceof Error ? error.message : String(error),
						timestamp: new Date().toISOString(),
					});
					progress.processedChatTurns++;
					progress.lastProcessedChatTurnId = chatTurnMetadata.chatTurnId;
				}
			}
			await saveLinkingProgress(progress); // Save after each batch
			console.log(`📊 Batch ${currentBatchNumber} completed. Progress saved.`);
			if (batchIndex < batches.length - 1) {
				console.log(`⏳ Brief pause before next batch...`);
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}
		}

		// ✅ Calculate final statistics (if any relevance scores were collected)
		if (allRelevanceScores.length > 0) {
			progress.statistics.averageRelevanceScore =
				allRelevanceScores.reduce((sum, score) => sum + score, 0) / allRelevanceScores.length;
		}

		// ✅ Set status to completed and update timestamp
		progress.status = 'completed';
		progress.lastUpdatedAt = new Date().toISOString(); // Ensure this is the very final update time

		// ✅ Save the FINAL "completed" progress state to the original file
		await saveLinkingProgress(progress);
		console.log(
			'\n🎉 Chat-to-history linking process has finished calculation and saved final state.'
		);

		// Now, we can print the summary based on the 'progress' object which is now 'completed'
		console.log(`📊 Final Summary for Process ID: ${progress.processId}`);
		console.log(`   • Status: ${progress.status}`);
		console.log(`   • Total chat turns: ${progress.totalChatTurns}`);
		console.log(`   • Processed chat turns: ${progress.processedChatTurns}`);
		console.log(`   • Chat turns updated: ${progress.updatedChatTurns}`);
		console.log(`   • Total history references added: ${progress.totalReferencesAdded}`);
		console.log(`   • Chat turns already linked: ${progress.statistics.chatTurnsAlreadyLinked}`);
		console.log(`   • Chat turns with no matches: ${progress.statistics.chatTurnsWithNoMatches}`);
		console.log(
			`   • Average relevance score: ${progress.statistics.averageRelevanceScore.toFixed(3)}`
		);
		console.log(
			`   • Highest relevance score: ${progress.statistics.highestRelevanceScore.toFixed(3)}`
		);
		console.log(`   • Processing errors: ${progress.errors.length}`);
		console.log(
			`   • Duration: ${((Date.parse(progress.lastUpdatedAt) - Date.parse(progress.startedAt)) / 1000 / 60).toFixed(1)} minutes`
		);

		if (progress.errors.length > 0) {
			console.log(`\n⚠️ Errors encountered during processing:`);
			progress.errors.slice(0, 5).forEach((error) => {
				console.log(`   • Turn ID [${error.chatTurnId}]: ${error.error}`);
			});
			if (progress.errors.length > 5) {
				console.log(
					`   • ... and ${progress.errors.length - 5} more errors (see progress file for details).`
				);
			}
		}

		// ✅ Backup the now-completed progress file
		const originalProgressPath = getProgressFilePath(progress.processId);
		const backupTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const backupDir = path.join(SCRIPT_OUTPUT_DIR, 'completed-progress-backups'); // Specific backup dir
		await fs.mkdir(backupDir, { recursive: true }); // Ensure backup directory exists

		const backupProgressPath = path.join(
			backupDir,
			`link-chat-history-progress-${progress.processId}-COMPLETED-${backupTimestamp}.json`
		);

		try {
			await fs.copyFile(originalProgressPath, backupProgressPath);
			console.log(`💾 Final progress file backed up to: ${backupProgressPath}`);

			// ✅ Delete the original progress file from the active 'progress' directory
			await fs.unlink(originalProgressPath);
			console.log(`🧹 Original active progress file cleaned up: ${originalProgressPath}`);
		} catch (backupError) {
			console.warn(`⚠️ Could not backup and/or delete original progress file:`, backupError);
			console.warn(`   Original progress file at: ${originalProgressPath}`);
		}

		// This 'catch' block handles errors from the entire 'try' block of linkChatToHistory
	} catch (error) {
		console.error('❌ Fatal error during linking process:', error);

		// Attempt to load and update progress file to 'failed'
		// Note: 'processId' here is from the top of the linkChatToHistory function
		const currentProgress = await loadLinkingProgress(processId);
		if (currentProgress) {
			currentProgress.status = 'failed';
			currentProgress.errors.push({
				chatTurnId: 'SYSTEM_FATAL',
				error: error instanceof Error ? error.message : String(error),
				timestamp: new Date().toISOString(),
			});
			await saveLinkingProgress(currentProgress);
			console.log(`🚨 Progress file updated to 'failed' state for process ID: ${processId}`);
		} else {
			console.log(`🚨 Could not load progress file to mark as 'failed' for process ID: ${processId}`);
		}

		// process.exit(1); // Already handled by the main execution block
	} finally {
		await closeFileLogger(); // Ensure logger is closed regardless of success or failure
	}
}

// ✅ Progress checking utility
async function checkLinkingProgress(processId?: string) {
	console.log('📋 Checking linking progress...');

	try {
		const files = await fs.readdir(PROGRESS_DIR);
		const progressFiles = files.filter((f) => f.startsWith(PROGRESS_FILE_PREFIX));

		if (progressFiles.length === 0) {
			console.log('📝 No active linking processes found.');
			return;
		}

		console.log(`📊 Found ${progressFiles.length} linking process(es):`);

		for (const file of progressFiles) {
			const filePath = path.join(PROGRESS_DIR, file);
			try {
				const data = await fs.readFile(filePath, 'utf-8');
				const progress: LinkingProgress = JSON.parse(data);

				if (processId && !progress.processId.includes(processId)) {
					continue;
				}

				console.log(`\n🔗 Process: ${progress.processId}`);
				console.log(`   Status: ${progress.status}`);
				console.log(
					`   Progress: ${progress.processedChatTurns}/${progress.totalChatTurns} (${((progress.processedChatTurns / progress.totalChatTurns) * 100).toFixed(1)}%)`
				);
				console.log(`   Batch: ${progress.currentBatch}/${progress.totalBatches}`);
				console.log(`   Updated: ${progress.updatedChatTurns} chat turns`);
				console.log(`   References added: ${progress.totalReferencesAdded}`);
				console.log(`   Errors: ${progress.errors.length}`);
				console.log(`   Started: ${new Date(progress.startedAt).toLocaleString()}`);
				console.log(`   Last updated: ${new Date(progress.lastUpdatedAt).toLocaleString()}`);
			} catch (error) {
				console.warn(`⚠️ Could not read progress file ${file}:`, error);
			}
		}
	} catch (error) {
		console.error('❌ Error checking progress:', error);
	}
}

// ✅ Main execution
const command = process.argv[2];

if (command === 'check') {
	const processId = process.argv[3];
	checkLinkingProgress(processId);
} else {
	linkChatToHistory().catch((err) => {
		console.error('🚨🚨 FATAL error in linkChatToHistory:', err);
		process.exit(1);
	});
}
