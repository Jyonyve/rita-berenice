// src/migration/history/initHistory.ts

import fs from 'node:fs/promises';
import path from 'node:path';
import { ChromaClient, Collection } from 'chromadb';
import { fileURLToPath } from 'node:url';

import { HistoryInfo } from '../../shared/domain/lore/LoreInterfaces.ts';
import { COLLECTIONS, METADATA_TYPES } from '../../shared/domain/chromadb/ChromaInterfaces.ts';
import { stringifyHistoryMetadata } from '../../shared/util/dbConvertUtils.ts';
import { buildHistoryId } from '../../server/util/buildIdUtils.ts';
import { buildLoreOrHistoryDocument } from '../../server/util/documentUtils.ts';
import { buildHistoryMetadataPrompt } from '../../server/util/templateUtils.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CHROMA_URL = process.env.CHROMA_API_URL || 'https://chromadb-flyio.fly.dev';
const HISTORY_RESULT_DIR = path.join(__dirname, 'result');
const CHARACTER_IDS = ['tarion_original', 'tarion_spinoff']; // Multiple characters can be affected
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
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
	existingHistoryEntries: Array<{ originalTitle: string; historyId: string; generatedTitle: string }>
): Promise<any> => {
	try {
		const prompt = buildHistoryMetadataPrompt(
			originalTitle,
			content,
			availableCharacterIds,
			existingHistoryEntries
		);
		const llmResponse = await generateHistoryMetadataLLM(prompt);
		const parsedMetadata = extractJsonFromMarkdown(llmResponse);

		return {
			generatedEnglishTitle: parsedMetadata.generatedEnglishTitle || originalTitle,
			englishId: parsedMetadata.englishId || `event_${Date.now()}`,
			keywords: parsedMetadata.keywords || [],
			topics: parsedMetadata.topics || [],
			entities: parsedMetadata.entities || [],
			ownerCharacterIds: parsedMetadata.ownerCharacterIds || [CHARACTER_IDS[0]],
			sideCharacterIds: parsedMetadata.sideCharacterIds || [],
			period: parsedMetadata.period || { label: 'Unknown', confidence: 0.5 },
			eventDate: parsedMetadata.eventDate || {
				value: 'Unknown',
				type: 'era_specific',
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
			ownerCharacterIds: [CHARACTER_IDS[0]],
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
	console.log(`Connecting to ChromaDB at: ${CHROMA_URL}`);
	console.log(`Reading history files from: ${HISTORY_RESULT_DIR}`);

	const chroma = new ChromaClient({ path: CHROMA_URL });
	let collection: Collection;

	try {
		console.log(`Ensuring history collection "${COLLECTIONS.LORE}" exists...`);
		collection = await chroma.getOrCreateCollection({
			name: COLLECTIONS.LORE,
			metadata: {
				description: 'Stores character history and lore with LLM-generated metadata.',
				created_by_script: 'initHistory.ts',
				type: COLLECTIONS.LORE,
				enrichment_model: ENRICHMENT_MODEL,
			},
		});
		console.log(`Collection "${COLLECTIONS.LORE}" ready.`);
	} catch (error) {
		console.error(
			`🚨 Failed to get or create ChromaDB collection "${COLLECTIONS.LORE}". Aborting.`,
			error
		);
		process.exit(1);
	}

	try {
		const allFiles = await fs.readdir(HISTORY_RESULT_DIR);
		const jsonFiles = allFiles.filter((file) => file.endsWith('.json'));

		if (jsonFiles.length === 0) {
			console.log(`No JSON files found in ${HISTORY_RESULT_DIR}. Nothing to process.`);
			return;
		}

		console.log(`Found ${jsonFiles.length} history files: ${jsonFiles.join(', ')}`);

		// First pass: collect all titles and create unique historyIds
		const historyEntries: Array<{
			fileName: string;
			originalTitle: string;
			historyId: string;
			generatedTitle: string;
			content: string;
		}> = [];

		for (const [index, fileName] of jsonFiles.entries()) {
			const filePath = path.join(HISTORY_RESULT_DIR, fileName);
			try {
				const fileContent = await fs.readFile(filePath, 'utf-8');
				const data: HistoryFileContent = JSON.parse(fileContent);

				if (data.title && data.content) {
					// ✅ Generate unique historyId first
					const basicEnglishId = `event_${index}_${fileName
						.replace('.json', '')
						.toLowerCase()
						.replace(/[^a-z0-9]/g, '_')}`;
					const historyId = buildHistoryId(basicEnglishId);

					historyEntries.push({
						fileName,
						originalTitle: data.title,
						historyId, // ✅ Use unique historyId
						generatedTitle: data.title, // Will be updated in second pass
						content: data.content,
					});
				}
			} catch (error) {
				console.warn(`  ⚠️ Error reading file "${fileName}":`, error);
			}
		}

		// Second pass: process each history with full context
		for (const [index, historyEntry] of historyEntries.entries()) {
			console.log(
				`\n📜 Processing history file: "${historyEntry.fileName}" (${index + 1}/${historyEntries.length})...`
			);
			console.log(`  📖 Original Title: "${historyEntry.originalTitle}"`);

			try {
				const now = new Date().toISOString();

				console.log(`  🧠 Extracting metadata for "${historyEntry.originalTitle}"...`);
				const enrichedMetadata = await enrichHistoryWithMetadata(
					historyEntry.originalTitle,
					historyEntry.content,
					CHARACTER_IDS,
					historyEntries.filter((h) => h.originalTitle !== historyEntry.originalTitle)
				);

				// Update the entry with LLM-generated data
				historyEntry.generatedTitle = enrichedMetadata.generatedEnglishTitle;

				// ✅ Create HistoryInfo with correct structure
				const historyInfo: HistoryInfo = {
					sessionId: '',
					characterId: CHARACTER_IDS[0], // Primary character
					type: METADATA_TYPES.HISTORY,
					createdAt: now,
					updatedAt: now,
					keywords: enrichedMetadata.keywords,
					topics: enrichedMetadata.topics,
					entities: enrichedMetadata.entities,
					sequence: index,
					historyId: historyEntry.historyId, // ✅ Use pre-generated unique ID
					title: historyEntry.originalTitle,
					generatedTitle: enrichedMetadata.generatedEnglishTitle,
					category: enrichedMetadata.category,

					// ✅ Temporal information (flattened fields)
					periodLabel: enrichedMetadata.period.label,
					periodConfidence: enrichedMetadata.period.confidence,
					eventDateValue: enrichedMetadata.eventDate.value,
					eventDateType: enrichedMetadata.eventDate.type,
					eventDateConfidence: enrichedMetadata.eventDate.confidence,

					content: historyEntry.content.trim(),

					// ✅ Rich arrays for application use
					ownerCharacterIdArray: enrichedMetadata.ownerCharacterIds,
					sideCharacterIdArray: enrichedMetadata.sideCharacterIds,
					allAffectedCharacterIdArray: [
						...enrichedMetadata.ownerCharacterIds,
						...enrichedMetadata.sideCharacterIds,
					],
					relatedEventsArray: enrichedMetadata.temporalRelations,
				};

				const chromaMetadata = stringifyHistoryMetadata(historyInfo);
				const documentForEmbedding = buildLoreOrHistoryDocument(historyInfo);

				await collection.upsert({
					ids: [historyEntry.historyId],
					documents: [documentForEmbedding],
					metadatas: [chromaMetadata as any], // Cast to any to avoid type issues
				});

				console.log(
					`  ✅ Successfully stored history "${historyEntry.originalTitle}" with ID: ${historyEntry.historyId}`
				);
				console.log(`     Generated Title: "${enrichedMetadata.generatedEnglishTitle}"`);
				console.log(`     English ID: ${enrichedMetadata.englishId}`);
				console.log(
					`     Period: ${enrichedMetadata.period.label} (confidence: ${enrichedMetadata.period.confidence})`
				);
				console.log(
					`     Event Date: ${enrichedMetadata.eventDate.value} (${enrichedMetadata.eventDate.type})`
				);
				console.log(`     Keywords: ${enrichedMetadata.keywords.join(', ')}`);
				console.log(`     Topics: ${enrichedMetadata.topics.join(', ')}`);
				console.log(`     Owner Characters: ${enrichedMetadata.ownerCharacterIds.join(', ')}`);
				console.log(`     Side Characters: ${enrichedMetadata.sideCharacterIds.join(', ')}`);
				console.log(`     Temporal Relations: ${enrichedMetadata.temporalRelations.length} relations`);
				console.log(`     Content preview: ${historyEntry.content.substring(0, 100)}...`);

				await new Promise((resolve) => setTimeout(resolve, 1000));
			} catch (fileError) {
				console.error(`  ❌ Error processing file "${historyEntry.fileName}":`, fileError);
				continue;
			}
		}

		console.log(`\n🎉 History initialization completed! Processed ${historyEntries.length} files.`);
	} catch (error) {
		console.error('❌ Error during history initialization:', error);
		process.exit(1);
	}
}

initHistoryFromFiles().catch((err) => {
	console.error('🚨🚨 FATAL Unhandled error in initHistoryFromFiles:', err);
	process.exit(1);
});
