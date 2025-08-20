// src/migration/history/initHistory.ts

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { HistoryInfo } from '#shared/domain/lore/LoreInterfaces.js';
import { COLLECTIONS } from '#server/db/ChromaInterfaces.js';
import { buildHistoryId, buildProfileId } from '#shared/util/buildIdUtils.js';
import { createHistoryMetadataSchema } from '#server/util/schemaUtils.js';
import { buildHistoryMetadataPrompt } from '#server/util/templateUtils.js';
import { loreStore } from '#server/store/loreStore.js';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatGroq } from '@langchain/groq';
import { RelatedEvent } from '#shared/domain/BaseTypes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configuration ---
const HISTORY_RESULT_DIR = path.join(__dirname, 'result');
const USER_ID = 'sunfish';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
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
		const { historyInfos } = await loreStore.getHistories(characterId);
		if (historyInfos.length > 0) {
			const mapped = historyInfos.map((h) => ({
				originalTitle: h.title,
				historyId: h.historyId,
				generatedTitle: h.generatedTitle,
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
	// Use the comprehensive, aligned schema
	const historySchema = createHistoryMetadataSchema(availableCharacterIds, existingHistoryEntries);
	// Ensure the prompt asks for all the fields in the schema
	const prompt = buildHistoryMetadataPrompt(
		originalTitle,
		content,
		availableCharacterIds,
		existingHistoryEntries
	);

	let enrichedData: z.infer<typeof historySchema>;

	try {
		// 1. Attempt OpenRouter
		console.log(`     📞 Calling OpenRouter (google/google/gemini-2.5-flash-lite)...`);
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
	} catch (openRouterError: any) {
		console.error(`     💥 OpenRouter failed.`, openRouterError.message);
		console.log(`     🔁 Falling back to direct Gemini...`);
		try {
			// 2. Fallback to Gemini
			const geminiClient = new ChatGoogleGenerativeAI({
				apiKey: GEMINI_API_KEY,
				model: 'gemini-2.0-flash',
				temperature: 0.2,
				maxOutputTokens: 2048,
			});
			const structuredGemini = geminiClient.withStructuredOutput(historySchema);
			enrichedData = await structuredGemini.invoke(prompt);
		} catch (geminiError: any) {
			console.error(`     💥 Direct Gemini also failed.`, geminiError.message);
			console.log(`     🔁 Falling back to Groq...`);
			// 3. Final fallback to Groq
			const groqClient = new ChatGroq({
				apiKey: GROQ_API_KEY,
				model: 'llama3-70b-8192',
				temperature: 0.2,
				maxTokens: 2048,
			});
			const structuredGroq = groqClient.withStructuredOutput(historySchema);
			enrichedData = await structuredGroq.invoke(prompt);
		}
	}
	return enrichedData;
};

// --- Main Initialization Script ---
async function initHistoryFromFiles() {
	console.log('🚀 Starting history initialization...');
	if (!OPENROUTER_API_KEY || !GEMINI_API_KEY || !GROQ_API_KEY) {
		console.error('🚨 One or more API keys are not set. Aborting.');
		process.exit(1);
	}

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
			console.log(`No JSON files found. Nothing to process.`);
			return;
		}
		console.log(`Found ${jsonFiles.length} history files to process.`);

		const existingHistories = await queryExistingHistories(characterId);

		for (const [index, fileName] of jsonFiles.entries()) {
			console.log(`\n📜 Processing history file: "${fileName}" (${index + 1}/${jsonFiles.length})...`);
			const filePath = path.join(HISTORY_RESULT_DIR, fileName);
			const fileContent = await fs.readFile(filePath, 'utf-8');
			const data: HistoryFileContent = JSON.parse(fileContent);

			if (existingHistories.some((h) => h.originalTitle === data.title)) {
				console.log(`   ⏭️ History with title "${data.title}" already exists. Skipping.`);
				continue;
			}

			try {
				const enrichedMetadata = await enrichHistoryWithMetadata(
					data.title,
					data.content,
					[characterId],
					existingHistories
				);

				const now = new Date().toISOString();
				const primaryCharacterId = characterId; // Assign a primary owner
				const historyId = buildHistoryId(primaryCharacterId, enrichedMetadata.period.label);

				// --- This mapping is now clean and directly aligned with HistoryInfo ---
				const historyInfo: HistoryInfo = {
					// Base Metadata
					userId: USER_ID,
					characterId: primaryCharacterId,
					profileId: buildProfileId(primaryCharacterId, USER_ID),
					type: 'history',
					createdAt: now,
					updatedAt: now,
					historyId,
					title: data.title,
					content: data.content.trim(),

					// Directly Mapped from the Aligned Schema
					generatedTitle: enrichedMetadata.generatedEnglishTitle,
					summary: enrichedMetadata.summary,
					category: enrichedMetadata.category,
					keywordList: enrichedMetadata.keywordList,
					topicList: enrichedMetadata.topicList,
					entityList: enrichedMetadata.entityList,
					sideCharacterIdList: enrichedMetadata.sideCharacterIdList,
					allAffectedCharacterIdList: [
						...new Set([primaryCharacterId, ...enrichedMetadata.sideCharacterIdList]),
					],
					periodLabel: enrichedMetadata.period.label,
					eventDateValue: enrichedMetadata.eventDate.value,
					eventDateType: enrichedMetadata.eventDate.type,
					relatedEventList: enrichedMetadata.relatedEventList.map((tr): RelatedEvent => {
						const relatedHistory = existingHistories.find(
							(h) => h.originalTitle === tr.relatedEventTitle
						);
						return {
							// `relatedHistory?.historyId` is mapped to `id`
							id: relatedHistory?.historyId || 'UNKNOWN_ID',
							// `tr.type` is mapped to `relationship`
							relationship: tr.type,
							// `tr.description` is mapped to `description`
							description: tr.description || '',
						};
					}),
				};

				await loreStore.storeHistory(historyInfo);

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
				continue;
			}
		}

		console.log('\n🎉 History initialization finished!');
	} catch (error) {
		console.error('❌ A fatal error occurred during the history initialization process:', error);
		process.exit(1);
	}
}

const characterId = process.argv[2];

initHistoryFromFiles().catch((err) => {
	console.error('🚨🚨 FATAL SCRIPT ERROR:', err);
	process.exit(1);
});
