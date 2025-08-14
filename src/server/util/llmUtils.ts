import OpenAI from 'openai';
import { ChatCompletion } from 'openai/resources/index.mjs';
import { ChromaResponse } from '#shared/api/ModuleResponse.js';
import { DefaultAiRole } from '#shared/domain/aimodel/index.js';
import { HistoryContext, HistoryInfo, LoreContext, LoreInfo } from '#shared/domain/lore/index.js';
import { logFlow } from './jsonlLogger.js';
import { ChatEntry, ChatTurn } from '#shared/domain/chat/ChatInterfaces.js';
import { parseEntriesToConversation } from './chatParseUtils.js';
import { Metadata } from 'chromadb';

export function isDirectOpenAIClient(llm: any): llm is OpenAI {
	// Check for a unique property or method of the OpenAI client instance
	// that Langchain BaseChatModel instances won't have.
	// '.chat.completions.create' is a reasonably safe indicator.
	return llm && typeof llm === 'object' && llm.chat?.completions?.create;
}

export const extractValidOpenAiContent = (response: ChatCompletion): string => {
	if (!response?.choices?.length) return '';
	const validChoice = response.choices.find((choice) => choice?.message?.content != null);
	return validChoice?.message?.content || '';
};

/**
 * Sanitizes and parses raw LLM response text into an array of structured ChatEntry objects.
 * - It distinguishes between narration (action) and dialogue.
 * - Consecutive lines of the same type are grouped into a single entry.
 *
 * @param text The raw string response from the LLM.
 * @returns An array of ChatEntry objects.
 */
export const sanitizeLlmResponse = (text: string): string => {
	logFlow('TextTransform', 'Starting text parsing to ChatEntry[]', {
		inputLength: text.length,
		preview: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
	});

	if (!text || text.trim() === '') {
		return '';
	}

	// Step 1: Split text into individual lines, trimming and removing empty lines.
	const lines = text
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0);

	// Step 2: Classify each line as 'dialogue' or 'action'.
	const classifiedLines: ChatEntry[] = lines.map((line) => {
		// Heuristic: A line is dialogue if it starts with a quote or common dialogue markers.
		const isDialogue = line.startsWith('"');
		// Clean the line by removing surrounding quotes for a clean prompt.
		const prompt = isDialogue ? line.replace(/^"|"$/g, '').trim() : line;
		const type = isDialogue ? 'dialogue' : 'action';
		return { type, prompt };
	});

	// Step 3: Group consecutive lines of the same type into blocks.
	if (classifiedLines.length === 0) {
		return '';
	}

	const groupedBlocks: ChatEntry[] = [];
	let currentBlock = { ...classifiedLines[0] };

	for (let i = 1; i < classifiedLines.length; i++) {
		const line = classifiedLines[i];
		if (line.type === currentBlock.type) {
			// If the line type is the same, append its content to the current block.
			currentBlock.prompt += `\n${line.prompt}`;
		} else {
			// If the type changes, push the completed block and start a new one.
			groupedBlocks.push(currentBlock);
			currentBlock = { ...line };
		}
	}
	// Add the last remaining block to the array.
	groupedBlocks.push(currentBlock);

	// Step 4: Convert each block into a ChatEntry object.
	const chatEntries: ChatEntry[] = groupedBlocks.map((block) => ({
		type: block.type,
		prompt: block.prompt,
	}));

	logFlow('TextTransform', 'Text parsing completed', {
		outputEntryCount: chatEntries.length,
		result: chatEntries,
	});

	return parseEntriesToConversation(chatEntries);
};

export const buildChatCompletion = (role: DefaultAiRole, content: string, name?: string) => {
	return { role, content, name };
};

// CORRECT mapping for Histories
export const mapHistoryContexts = (historyInfos: HistoryInfo[]): HistoryContext[] =>
	historyInfos.map((history) => {
		return {
			// --- Explicitly list only the fields you need ---
			historyId: history.historyId,
			title: history.title,
			summary: history.summary,
			category: history.category,
			periodLabel: history.periodLabel,
			keywordList: history.keywordList,
			topicList: history.topicList,
			entityList: history.entityList,
			allAffectedCharacterIdList: history.allAffectedCharacterIdList,
		};
	});

// CORRECT mapping for Lore
export const mapLoreContexts = (loreInfos: LoreInfo[]): LoreContext[] =>
	loreInfos.map((lore) => {
		return {
			loreId: lore.loreId,
			title: lore.title,
			summary: lore.summary,
			category: lore.category,
			keywordList: lore.keywordList,
			topicList: lore.topicList,
			entityList: lore.entityList,
			allAffectedCharacterIdList: lore.allAffectedCharacterIdList,
		};
	});

// query reranking

// Configuration for semantic ranking
export const SEMANTIC_RANKING_CONFIG = {
	WEIGHTS: { semantic: 0.7, recency: 0.3 },
	RECENT_WINDOW_MS: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// Types for ranking
export type RankableHit = {
	id: string;
	document: string | null;
	metadata: Metadata | null;
	distance: number | null;
};

export type ScoredHit = RankableHit & {
	score: number;
	semanticScore: number;
	recencyScore: number;
};

// Normalize distances to semantic scores [0..1]; lower distance => higher score
export const normalizeSemanticScores = (distances: number[]): number[] => {
	if (!distances.length) return [];

	const finite = distances.map((d) => (Number.isFinite(d) ? d : Number.POSITIVE_INFINITY));
	const minD = Math.min(...finite);
	const maxD = Math.max(...finite);

	if (!Number.isFinite(minD) || !Number.isFinite(maxD)) {
		return distances.map(() => 0);
	}
	if (maxD === minD) return distances.map(() => 1);

	return finite.map((d) => 1 - (d - minD) / (maxD - minD));
};

// Compute recency score [0..1] from updatedAt ISO; newer -> closer to 1
export const computeRecencyScore = (updatedAt?: string): number => {
	if (!updatedAt) return 0;

	const ts = Date.parse(updatedAt);
	if (Number.isNaN(ts)) return 0;

	const age = Date.now() - ts;
	if (age <= 0) return 1;

	const score = 1 - Math.min(age / SEMANTIC_RANKING_CONFIG.RECENT_WINDOW_MS, 1);
	return Math.max(0, Math.min(1, score));
};

// Extract distance from various ChromaDB distance formats
export const extractDistance = (distanceRaw: any): number | null => {
	if (Array.isArray(distanceRaw)) {
		return distanceRaw[0] ?? null;
	}
	return typeof distanceRaw === 'number' ? distanceRaw : null;
};

/**
 * Flatten ChromaDB query results into hits array
 * @param queryResults Array of ChromaResponse from queryRecords
 * @returns Flattened array of hits with distances
 */
export const flattenQueryResults = (queryResults: ChromaResponse[]): RankableHit[] => {
	const hits: RankableHit[] = [];

	for (const group of queryResults) {
		const len = group.ids.length;
		for (let i = 0; i < len; i++) {
			const distance = extractDistance(group.distances?.[i]);
			hits.push({
				id: group.ids[i],
				document: group.documents[i] ?? null,
				metadata: group.metadatas[i] ?? null,
				distance,
			});
		}
	}

	return hits;
};

/**
 * Core semantic ranking function - reusable across all stores
 * @param hits Array of hits from query results
 * @param options Optional configuration overrides
 * @returns Scored and sorted hits array
 */
export const rankBySemanticScore = (
	hits: RankableHit[],
	options?: {
		semanticWeight?: number;
		recencyWeight?: number;
		updatedAtField?: string; // Allow different metadata field names
	}
): ScoredHit[] => {
	if (!hits.length) return [];

	const semanticWeight = options?.semanticWeight ?? SEMANTIC_RANKING_CONFIG.WEIGHTS.semantic;
	const recencyWeight = options?.recencyWeight ?? SEMANTIC_RANKING_CONFIG.WEIGHTS.recency;
	const updatedAtField = options?.updatedAtField ?? 'updatedAt';

	// Normalize semantic scores
	const rawDistances = hits.map((h) =>
		typeof h.distance === 'number' ? h.distance : Number.POSITIVE_INFINITY
	);
	const semanticScores = normalizeSemanticScores(rawDistances);

	// Compute blended scores
	const scored: ScoredHit[] = hits.map((hit, i) => {
		const semanticScore = semanticScores[i] ?? 0;
		const recencyScore = computeRecencyScore((hit.metadata as any)?.[updatedAtField]);
		const score = semanticWeight * semanticScore + recencyWeight * recencyScore;

		return { ...hit, score, semanticScore, recencyScore };
	});

	// Sort by blended score (desc), tie-break by newer updatedAt
	scored.sort((a, b) => {
		if (b.score !== a.score) return b.score - a.score;

		const ta = Date.parse((a.metadata as any)?.[updatedAtField] ?? '');
		const tb = Date.parse((b.metadata as any)?.[updatedAtField] ?? '');
		return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
	});

	return scored;
};

/**
 * Re-ranks ChromaDB results based on a combination of semantic distance and recency.
 * @param response The raw response from a ChromaDB query.
 * @param decayRate A factor controlling how quickly older items lose relevance (e.g., 0.1).
 * @param semanticWeight Weight for semantic similarity (default: 0.7)
 * @param recencyWeight Weight for recency (default: 0.3)
 * @returns The same ChromaResponse object, but with its contents sorted by the new combined score.
 */
export function reRankByRecency<T extends { updatedAt: string }>(
	response: ChromaResponse & { contents?: T[] },
	decayRate: number = 0.05,
	semanticWeight: number = 0.7,
	recencyWeight: number = 0.3
): ChromaResponse & { contents?: T[] } {
	if (!response.documents || !response.distances || !response.contents) {
		return response; // Not enough data to rank
	}

	const now = Date.now();
	const rankedItems = (response.distances[0] || [])
		.map((distance, index) => {
			const item = response.contents![index];
			const ageInDays = (now - Date.parse(item.updatedAt)) / (1000 * 60 * 60 * 24);

			// 1. Normalize semantic distance (lower is better) to a score (higher is better)
			const semanticScore = 1 / (1 + distance);

			// 2. Calculate recency score using exponential decay
			const recencyScore = Math.exp(-decayRate * ageInDays);

			// 3. Combine the scores with configurable weights
			const combinedScore = semanticScore * semanticWeight + recencyScore * recencyWeight;

			return {
				id: response.ids[index],
				document: response.documents![index],
				metadata: response.metadatas![index],
				content: item,
				combinedScore,
			};
		})
		.sort((a, b) => b.combinedScore - a.combinedScore); // Sort descending by combined score

	// Reconstruct the ChromaResponse object with the sorted data
	return {
		ids: rankedItems.map((item) => item.id),
		documents: rankedItems.map((item) => item.document),
		metadatas: rankedItems.map((item) => item.metadata),
		contents: rankedItems.map((item) => item.content),
		// Note: distances are no longer meaningful after re-ranking
	};
}
/**
 * Boosts relevance scores for items containing the critical term.
 * @param results Array of ChatTurn, LoreInfo, or HistoryInfo objects
 * @param criticalTerm The most important search term extracted from user input
 * @returns The same array with relevance boost scores applied and sorted by relevance
 */
export const boostByCriticalTerm = <T extends ChatTurn | LoreInfo | HistoryInfo>(
	results: T[],
	criticalTerm: string | undefined,
	queryTexts: string[] = []
): T[] => {
	if (!criticalTerm || results.length === 0) return results;

	return results
		.map((item) => {
			// Check if the critical term appears in the item's searchable fields
			const itemText = JSON.stringify(item).toLowerCase();
			const hasCriticalTerm = itemText.includes(criticalTerm.toLowerCase());

			return {
				...item,
				_relevanceBoost: hasCriticalTerm ? 1.5 : 1.0, // 50% boost if critical term found
			} as T & { _relevanceBoost: number };
		})
		.sort((a, b) => {
			const aBoost = (a as any)._relevanceBoost || 1;
			const bBoost = (b as any)._relevanceBoost || 1;
			return bBoost - aBoost;
		})
		.map(({ _relevanceBoost, ...item }) => item as unknown as T); // Remove the temporary boost property
};
