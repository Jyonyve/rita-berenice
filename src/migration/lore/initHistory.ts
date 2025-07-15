// src/migration/history/initHistory.ts

import fs from 'node:fs/promises';
import path from 'node:path';
import { ChromaClient, Collection, IncludeEnum, Where } from 'chromadb';
import { fileURLToPath } from 'node:url';

import { HistoryInfo } from '../../shared/domain/lore/LoreInterfaces.js';
import { COLLECTIONS } from '../../server/db/ChromaInterfaces.js';
import { historyToMetadata } from '../../shared/util/dbConvertUtils.js';
import { buildHistoryId } from '../../shared/util/buildIdUtils.js';
import { flatLoreOrHistoryToDoc } from '../../server/util/documentUtils.js';
import { buildHistoryMetadataPrompt } from '../../server/util/templateUtils.js';
import e from 'express';
import { METADATA_TYPES } from '#shared/config/constants.js';
import { loreStore } from '#server/store/loreStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const USER_ID = process.env.USER_ID || '6b335673-c837-43f9-a1c7-0b92c90edefb';

const HISTORY_RESULT_DIR = path.join(__dirname, 'result');
const CHARACTER_IDS = ['tarion_original', 'tarion_spinoff'];
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyAfhl_AyupNyz9CpxscySkvGmxRsJKcXxk';
const ENRICHMENT_MODEL = 'gemini-2.0-flash-001';
const MAX_LLM_RETRIES = 3;

interface HistoryFileContent {
	title: string;
	content: string;
}

const extractJsonFromMarkdown = (response: string): any => {
	let cleaned = response.trim();
	try {
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
		console.error('JSON extraction failed. Raw text snippet:', cleaned.substring(0, 300));
		return {
			generatedEnglishTitle: 'Unknown Event',
			englishId: 'unknown_event',
			keywords: [],
			topics: [],
			entities: [],
			ownerCharacterIds: [CHARACTER_IDS[0]],
			sideCharacterIds: [],
			period: { label: 'Unknown', confidence: 0.5 },
			eventDate: { value: 'Unknown', type: 'era_specific', confidence: 0.5 },
			temporalRelations: [],
			category: 'character_history',
		};
	}
};

// ✅ NEW: Function to query existing histories for relationship building
const queryExistingHistories = async (
	characterIds: string[]
): Promise<Array<{ originalTitle: string; historyId: string; generatedTitle: string }>> => {
	console.log(`    🔍 Querying existing histories for characters: ${characterIds.join(', ')}`);
	const allExistingHistories: Array<{
		originalTitle: string;
		historyId: string;
		generatedTitle: string;
	}> = [];

	for (const characterId of characterIds) {
		try {
			const { historyInfos: histories } = await loreStore.getHistories(characterId);
			if (histories.length > 0) {
				const mapped = histories.map((h) => ({
					originalTitle: h.title,
					historyId: h.historyId,
					generatedTitle: h.generatedTitle,
				}));
				allExistingHistories.push(...mapped);
			}
		} catch (error) {
			console.warn(`    ⚠️ Could not fetch histories for ${characterId}:`, error);
		}
	}

	console.log(
		`    📚 Found ${allExistingHistories.length} existing histories for relationship building`
	);
	return allExistingHistories;
};

// ✅ NEW: Function to query existing lore for context
const queryExistingLore = async (characterIds: string[]): Promise<string[]> => {
	console.log(`    🔍 Querying existing lore for characters: ${characterIds.join(', ')}`);
	const allLoreIds: string[] = [];

	for (const characterId of characterIds) {
		try {
			const { loreInfos: lores } = await loreStore.getLores(characterId);
			if (lores.length > 0) {
				allLoreIds.push(...lores.map((l) => l.loreId));
			}
		} catch (error) {
			console.warn(`    ⚠️ Could not fetch lore for ${characterId}:`, error);
		}
	}

	console.log(`    📖 Found ${allLoreIds.length} existing lore entries`);
	return allLoreIds;
};

const generateHistoryMetadataLLM = async (prompt: string, attempt = 1): Promise<string> => {
	if (!GEMINI_API_KEY) {
		throw new Error('GEMINI_API_KEY environment variable is required for LLM calls.');
	}

	console.log(
		`    📞 Calling Gemini API for history metadata extraction (Attempt ${attempt}/${MAX_LLM_RETRIES})...`
	);

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
			if (response.status === 429 && attempt < MAX_LLM_RETRIES) {
				const retryAfter = response.headers.get('retry-after');
				const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
				console.warn(`    ⏳ Gemini rate limited. Waiting ${waitTime}ms (Attempt ${attempt})`);
				await new Promise((resolve) => setTimeout(resolve, waitTime));
				return generateHistoryMetadataLLM(prompt, attempt + 1);
			}
			throw new Error(`Gemini API Error: ${response.status} ${response.statusText}`);
		}

		const data = await response.json();
		const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

		if (!content) {
			throw new Error('Empty response content from Gemini API');
		}

		console.log(`    🗣️ Gemini API response received for history metadata extraction.`);
		return content;
	} catch (error) {
		console.error(`    💥 LLM Error (Attempt ${attempt}/${MAX_LLM_RETRIES}):`, error);
		if (attempt < MAX_LLM_RETRIES) {
			const backoffTime = Math.pow(2, attempt) * 1000;
			console.warn(`    ↪️ Retrying LLM in ${backoffTime / 1000}s...`);
			await new Promise((resolve) => setTimeout(resolve, backoffTime));
			return generateHistoryMetadataLLM(prompt, attempt + 1);
		}
		throw error;
	}
};

const enrichHistoryWithMetadata = async (
	originalTitle: string,
	content: string,
	availableCharacterIds: string[],
	existingHistoryEntries: Array<{
		originalTitle: string;
		historyId: string;
		generatedTitle: string;
	}>,
	existingLoreIds: string[] = []
): Promise<any> => {
	try {
		const prompt = buildHistoryMetadataPrompt(
			originalTitle,
			content,
			availableCharacterIds,
			existingHistoryEntries,
			existingLoreIds
		);
		const llmResponse = await generateHistoryMetadataLLM(prompt);
		const parsedMetadata = extractJsonFromMarkdown(llmResponse);

		return {
			generatedEnglishTitle: parsedMetadata.generatedEnglishTitle || originalTitle,
			englishId: parsedMetadata.englishId || ``,
			keywords: parsedMetadata.keywords || [],
			topics: parsedMetadata.topics || [],
			entities: parsedMetadata.entities || [],
			ownerCharacterIds: parsedMetadata.ownerCharacterIds || CHARACTER_IDS,
			sideCharacterIds: parsedMetadata.sideCharacterIds || [],
			period: parsedMetadata.period || { label: 'Unknown', confidence: 0.5 },
			eventDate: parsedMetadata.eventDate || {
				value: 'Unknown',
				type: 'relative_to_event',
				confidence: 0.5,
			},
			temporalRelations: parsedMetadata.temporalRelations || [],
			category: parsedMetadata.category || 'character_history',
		};
	} catch (error) {
		console.warn(`    ⚠️ LLM metadata extraction failed, using defaults:`, error);
		return {
			generatedEnglishTitle: originalTitle,
			englishId: `event_${Date.now()}`,
			keywords: [],
			topics: [],
			entities: [],
			ownerCharacterIds: CHARACTER_IDS,
			sideCharacterIds: [],
			period: { label: 'Unknown', confidence: 0.5 },
			eventDate: { value: 'Unknown', type: 'era_specific', confidence: 0.5 },
			temporalRelations: [],
			category: 'character_history',
		};
	}
};
async function initHistoryFromFiles() {
	console.log('🚀 Starting history initialization with LLM metadata extraction...');
	if (!GEMINI_API_KEY) {
		console.error('🚨 GEMINI_API_KEY is not set. Aborting.');
		process.exit(1);
	}
	console.log(`Reading history files from: ${HISTORY_RESULT_DIR}`);

	// --- REFACTOR START: Centralized DB connection ---
	console.log(`Ensuring connection to ChromaDB via centralized loreStore...`);
	try {
		// "Warm up" the connection by calling the store's getter.
		// This will initialize the client and ensure the collection exists.
		await loreStore._getCollection();
		console.log(`Collection "${COLLECTIONS.LORE}" is ready via loreStore.`);
	} catch (error) {
		console.error(
			`🚨 Failed to connect to or create ChromaDB collection "${COLLECTIONS.LORE}" via loreStore. Aborting.`,
			error
		);
		process.exit(1);
	}
	// --- REFACTOR END ---

	try {
		const allFiles = await fs.readdir(HISTORY_RESULT_DIR);
		const jsonFiles = allFiles.filter((file) => file.endsWith('.json'));

		if (jsonFiles.length === 0) {
			console.log(`No JSON files found in ${HISTORY_RESULT_DIR}. Nothing to process.`);
			return;
		}

		console.log(`Found ${jsonFiles.length} history files: ${jsonFiles.join(', ')}`);

		// ✅ This part now uses the refactored functions above
		console.log('\n🔍 Querying existing data for relationship building...');
		const existingHistories = await queryExistingHistories(CHARACTER_IDS);
		const existingLoreIds = await queryExistingLore(CHARACTER_IDS);

		// First pass: collect all titles and create unique historyIds
		const historyEntries: Array<{
			fileName: string;
			originalTitle: string;
			englishId?: string; // ✅ Optional until LLM provides it
			historyId?: string; // ✅ Optional until LLM provides englishId
			generatedTitle: string;
			content: string;
		}> = [];

		for (const [index, fileName] of jsonFiles.entries()) {
			const filePath = path.join(HISTORY_RESULT_DIR, fileName);
			try {
				const fileContent = await fs.readFile(filePath, 'utf-8');
				const data: HistoryFileContent = JSON.parse(fileContent);

				if (data.title && data.content) {
					historyEntries.push({
						fileName,
						originalTitle: data.title,
						// ✅ NO englishId or historyId generation here
						generatedTitle: data.title,
						content: data.content,
					});
				}
			} catch (error) {
				console.warn(`  ⚠️ Error reading file "${fileName}":`, error);
			}
		}

		// Second pass: process each history with LLM and generate IDs
		for (const [index, historyEntry] of historyEntries.entries()) {
			console.log(
				`\n📜 Processing history file: "${historyEntry.fileName}" (${index + 1}/${historyEntries.length})...`
			);

			try {
				const now = new Date().toISOString();

				// ✅ Get existing histories that already have historyIds
				const allAvailableHistories = [
					...existingHistories,
					...historyEntries
						.slice(0, index) // Only include already processed entries
						.filter((h) => h.historyId) // Only include those with historyId
						.map((h) => ({
							originalTitle: h.originalTitle,
							historyId: h.historyId!,
							generatedTitle: h.generatedTitle,
						})),
				];

				console.log(
					`  🧠 Extracting metadata for "${historyEntry.originalTitle}" with ${allAvailableHistories.length} existing histories...`
				);

				const enrichedMetadata = await enrichHistoryWithMetadata(
					historyEntry.originalTitle,
					historyEntry.content,
					CHARACTER_IDS,
					allAvailableHistories,
					existingLoreIds
				);

				// ✅ NOW generate historyId using LLM-provided englishId
				historyEntry.englishId = enrichedMetadata.englishId;
				historyEntry.historyId = buildHistoryId(enrichedMetadata.englishId); // ✅ Use LLM englishId
				historyEntry.generatedTitle = enrichedMetadata.generatedEnglishTitle;

				// ✅ Create HistoryInfo with LLM-generated historyId
				const historyInfo: HistoryInfo = {
					userId: 'sunfish',
					characterId: CHARACTER_IDS[1],
					type: METADATA_TYPES.HISTORY,
					createdAt: now,
					updatedAt: now,
					keywords: enrichedMetadata.keywords,
					topics: enrichedMetadata.topics,
					entities: enrichedMetadata.entities,
					sequence: index,
					historyId: buildHistoryId(enrichedMetadata.englishId), // ✅ Use LLM-generated englishId
					englishId: enrichedMetadata.englishId,
					title: historyEntry.originalTitle,
					generatedTitle: enrichedMetadata.generatedEnglishTitle,
					category: enrichedMetadata.category,
					summary: enrichedMetadata.summary,
					periodLabel: enrichedMetadata.period.label,
					periodConfidence: enrichedMetadata.period.confidence,
					eventDateValue: enrichedMetadata.eventDate.value,
					eventDateType: enrichedMetadata.eventDate.type,
					eventDateConfidence: enrichedMetadata.eventDate.confidence,
					content: historyEntry.content.trim(),
					ownerCharacterIdArray: enrichedMetadata.ownerCharacterIds,
					sideCharacterIdArray: enrichedMetadata.sideCharacterIds,
					allAffectedCharacterIdArray: [
						...enrichedMetadata.ownerCharacterIds,
						...enrichedMetadata.sideCharacterIds,
					],
					relatedEventsArray: enrichedMetadata.temporalRelations,
				};

				await loreStore.storeHistory(historyInfo);

				console.log(
					`  ✅ Successfully stored history "${historyInfo.title}" with ID: ${historyInfo.historyId}`
				);
				console.log(`     Generated Title: "${enrichedMetadata.generatedEnglishTitle}"`);
				console.log(`     English ID: ${enrichedMetadata.englishId}`);

				await new Promise((resolve) => setTimeout(resolve, 1000));
			} catch (fileError) {
				console.error(`  ❌ Error processing file "${historyEntry.fileName}":`, fileError);
				continue;
			}
		}
	} catch (error) {
		console.error('❌ Error during history initialization:', error);
		process.exit(1);
	}
}

initHistoryFromFiles().catch((err) => {
	console.error('🚨🚨 FATAL Unhandled error in initHistoryFromFiles:', err);
	process.exit(1);
});
