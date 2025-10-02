// src/migration/history/initHistory.ts

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

import { ChatOpenAI } from '@langchain/openai';
import { historyStore, loreStore, termStore } from '@rita-berenice/server/store';
import { COLLECTIONS } from '@rita-berenice/server/db';
import {
	createHistoryMetadataSchema,
	mapTerms,
	buildHistoryMetadataPrompt,
} from '@rita-berenice/server/util';
import { HistoryInfo } from '@rita-berenice/shared/domain';
import { buildHistoryId, buildProfileId } from '@rita-berenice/shared/util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configuration ---
const HISTORY_RESULT_DIR = path.join(__dirname, 'result');
const USER_ID = 'sunfish';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const APP_TITLE = 'Rita-Berenice';
const REPO_URL = 'https://github.com/Jyonyve/rita-berenice';

// --- Type Definitions ---
interface HistoryFileContent {
	title: string;
	content: string;
}

interface ExistingHistoryEntry {
	originalTitle: string;
	historyId: string;
	generatedTitle: string;
}

// --- Data Fetching Functions ---
const queryExistingHistories = async (characterId: string): Promise<ExistingHistoryEntry[]> => {
	const allExistingHistories: ExistingHistoryEntry[] = [];

	try {
		const historyResponse = await historyStore.getHistories(characterId);
		if (historyResponse.historyInfos && historyResponse.historyInfos.length > 0) {
			const mapped = historyResponse.historyInfos.map((h) => ({
				originalTitle: h.title,
				historyId: h.historyId,
				generatedTitle: h.generatedTitle,
				summary: h.summary, // Add this
				category: h.category, // Add this
				periodLabel: h.periodLabel, // Add this
			}));
			allExistingHistories.push(...mapped);
		}
	} catch (error) {
		console.warn(`   ⚠️ Could not fetch histories for ${characterId}. It may be the first run.`);
	}

	console.log(`   📚 Found ${allExistingHistories.length} existing histories.`);
	return allExistingHistories;
};

// --- LLM Enrichment Function ---
const enrichHistoryWithMetadata = async (
	originalTitle: string,
	content: string,
	availableCharacterIds: string[],
	existingHistoryEntries: ExistingHistoryEntry[]
) => {
	const historySchema = createHistoryMetadataSchema(availableCharacterIds, existingHistoryEntries);
	const termResponse = await termStore.getTermsByCharacterId(characterId);
	const termGuidanceMap = mapTerms(termResponse.terms);
	const prompt = buildHistoryMetadataPrompt(
		originalTitle,
		content,
		availableCharacterIds,
		existingHistoryEntries,
		termGuidanceMap
	);

	let enrichedData: z.infer<typeof historySchema>;

	try {
		console.log(`     📞 Calling OpenRouter (google/gemini-2.5-flash-lite)...`);
		const openRouterClient = new ChatOpenAI({
			apiKey: OPENROUTER_API_KEY,
			model: 'google/gemini-2.5-flash-lite',
			temperature: 0.2,
			maxTokens: 2048,
			configuration: {
				baseURL: 'https://openrouter.ai/api/v1',
				defaultHeaders: { 'HTTP-Referer': REPO_URL, 'X-Title': APP_TITLE },
			},
		});
		const structuredOpenRouter = openRouterClient.withStructuredOutput(historySchema);
		enrichedData = await structuredOpenRouter.invoke(prompt);
		console.log(`     ✅ OpenRouter call successful`);
	} catch (openRouterError: any) {
		console.error(`     💥 OpenRouter failed:`, openRouterError.message);
		throw new Error(`LLM enrichment failed: ${openRouterError.message}`);
	}

	return enrichedData;
};

// --- Main Initialization Script ---
async function initHistoryFromFiles(characterId: string) {
	console.log('🚀 Starting history initialization...');

	if (!OPENROUTER_API_KEY) {
		console.error('🚨 OPENROUTER_API_KEY is not set. Aborting.');
		process.exit(1);
	}

	if (!characterId) {
		console.error('🚨 characterId argument is required. Usage: bun initHistory.ts <characterId>');
		process.exit(1);
	}

	console.log(`📋 Processing histories for character: ${characterId}`);
	console.log(`Ensuring connection to ChromaDB via loreStore...`);

	try {
		await loreStore._getCollection();
		console.log(`Collection "${COLLECTIONS.LORE}" is ready.`);
	} catch (error) {
		console.error(`🚨 Failed to connect to ChromaDB collection. Aborting.`, error);
		process.exit(1);
	}

	try {
		const jsonFiles = (await fs.readdir(HISTORY_RESULT_DIR)).filter((file) => file.endsWith('.json'));
		if (jsonFiles.length === 0) {
			console.log(`No JSON files found in ${HISTORY_RESULT_DIR}. Nothing to process.`);
			return;
		}
		console.log(`Found ${jsonFiles.length} history files to process.`);

		const existingHistories = await queryExistingHistories(characterId);

		for (const [index, fileName] of jsonFiles.entries()) {
			console.log(`\n📜 Processing history file: "${fileName}" (${index + 1}/${jsonFiles.length})...`);
			const filePath = path.join(HISTORY_RESULT_DIR, fileName);
			const fileContent = await fs.readFile(filePath, 'utf-8');
			const data: HistoryFileContent = JSON.parse(fileContent);

			// if (existingHistories.some((h) => h.originalTitle === data.title)) {
			// 	console.log(`   ⏭️ History with title "${data.title}" already exists. Skipping.`);
			// 	continue;
			// }

			try {
				const enrichedMetadata = await enrichHistoryWithMetadata(
					data.title,
					data.content,
					[characterId],
					existingHistories
				);

				const now = new Date().toISOString();
				const historyId = buildHistoryId(characterId, enrichedMetadata.period.label);

				// --- PERFECTLY ALIGNED WITH HistoryInfo INTERFACE ---
				const historyInfo: HistoryInfo = {
					// HistoryMetadata fields
					type: 'history',
					historyId,
					characterId,
					userId: USER_ID,
					createdAt: now,
					updatedAt: now,
					title: data.title,
					generatedTitle: enrichedMetadata.generatedTitle,
					category: enrichedMetadata.category,
					summary: enrichedMetadata.summary,
					periodLabel: enrichedMetadata.period.label,
					eventDateValue: enrichedMetadata.eventDate.value,
					eventDateType: enrichedMetadata.eventDate.type,

					// HistoryInfo extension fields
					content: data.content.trim(),
					sideCharacterIdList: enrichedMetadata.sideCharacterIdList || [],
					allAffectedCharacterIdList: [
						...new Set([characterId, ...(enrichedMetadata.sideCharacterIdList || [])]),
					],
					relatedEventList: (enrichedMetadata.relatedEventList || []).map((tr) => {
						const relatedHistory = existingHistories.find(
							(h) => h.originalTitle === tr.relatedEventTitle
						);
						return {
							id: relatedHistory?.historyId || 'UNKNOWN_ID',
							relationship: tr.type,
							description: tr.description || '',
						};
					}),
					keywordList: enrichedMetadata.keywordList || [],
					topicList: enrichedMetadata.topicList || [],
					entityList: enrichedMetadata.entityList || [],
				};

				// Store using the updated loreStore method
				await historyStore.storeHistory(historyInfo);

				console.log(
					`   ✅ Successfully stored history "${historyInfo.title}" with ID: ${historyInfo.historyId}`
				);

				// Add the new history to the context for the next iteration
				existingHistories.push({
					originalTitle: historyInfo.title,
					historyId: historyInfo.historyId,
					generatedTitle: historyInfo.generatedTitle,
				});
			} catch (fileError: any) {
				console.error(`   ❌ Error processing file "${fileName}":`, fileError.message);
				console.error(`   Stack trace:`, fileError.stack);
				continue;
			}
		}

		console.log('\n🎉 History initialization finished!');
	} catch (error) {
		console.error('❌ A fatal error occurred during the history initialization process:', error);
		process.exit(1);
	}
}

// --- Script Execution ---
const characterId = process.argv[2];

if (!characterId) {
	console.error('🚨 Error: Please provide a characterId as a command-line argument.');
	console.log('Usage: bun src/migration/history/initHistory.ts <characterId>');
	process.exit(1);
}

initHistoryFromFiles(characterId).catch((err) => {
	console.error('🚨🚨 FATAL SCRIPT ERROR:', err);
	process.exit(1);
});
