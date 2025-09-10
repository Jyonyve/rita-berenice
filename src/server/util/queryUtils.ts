import { Where, Metadata } from 'chromadb';
import { ChromaResponse } from '#shared/api/ModuleResponse.js';
import { get_encoding } from 'tiktoken';

export function isAndWhere(where: Where): where is { $and: Where[] } {
	return where && '$and' in where && Array.isArray((where as any).$and);
}

// Memory configuration constants
export const MEMORY_CONFIG = {
	MAX_PREFILTER_TURNS: 100, // Limit pre-filtered results
	RECENT_BIAS_WEIGHT: 0.3, // Weight for recency in scoring
	SEMANTIC_WEIGHT: 0.7, // Weight for semantic similarity
};

// Token counting utility with proper error handling
export const getTokenCount = (text: string): number => {
	let encoding;
	try {
		encoding = get_encoding('cl100k_base');
		const tokens = encoding.encode(text);
		const tokenCount = tokens.length;
		encoding.free();
		return tokenCount;
	} catch (error) {
		if (encoding) {
			encoding.free();
		}
		console.error('[QueryUtils] Token counting failed:', error);
		return Math.ceil(text.length / 4); // Fallback estimation
	}
};

// Helper function to prioritize recent turns
export const prioritizeRecentTurns = (
	turnIds: string[],
	maxTurns: number = MEMORY_CONFIG.MAX_PREFILTER_TURNS
): string[] => {
	const turnsWithNumbers = turnIds
		.map((id) => {
			const match = id.match(/_(\d+)_turn$/);
			return match ? { id, turnNumber: parseInt(match[1]) } : null;
		})
		.filter((item): item is { id: string; turnNumber: number } => item !== null)
		.sort((a, b) => b.turnNumber - a.turnNumber); // Most recent first

	return turnsWithNumbers.slice(0, maxTurns).map((item) => item.id);
};

// Types for ranking
export type RankedHit = {
	id: string;
	document: string | null;
	metadata: Metadata | null;
	distance: number;
	semanticScore: number;
	recencyScore: number;
	combinedScore: number;
};

// Configuration for semantic ranking
const SEMANTIC_RANKING_CONFIG = {
	WEIGHTS: { semantic: 0.7, recency: 0.3 },
	RECENT_WINDOW_MS: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// Normalize distances to semantic scores [0..1]; lower distance => higher score
const normalizeSemanticScores = (distances: number[]): number[] => {
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

// Calculate recency score from updatedAt timestamp
const calculateRecencyScore = (updatedAt?: string): number => {
	if (!updatedAt) return 0;

	const timestamp = Date.parse(updatedAt);
	if (Number.isNaN(timestamp)) return 0;

	const age = Date.now() - timestamp;
	if (age <= 0) return 1;

	return Math.max(0, 1 - age / SEMANTIC_RANKING_CONFIG.RECENT_WINDOW_MS);
};

// Extract distance from various ChromaDB distance formats
const extractDistance = (distanceRaw: any): number | null => {
	if (Array.isArray(distanceRaw)) {
		return distanceRaw[0] ?? null;
	}
	return typeof distanceRaw === 'number' ? distanceRaw : null;
};

/**
 * Complete semantic ranking pipeline for ChromaDB query results
 */
export const reRankSemanticResults = (
	queryResults: ChromaResponse[],
	limit?: number,
	options?: { semanticWeight?: number; recencyWeight?: number; updatedAtField?: string }
): {
	ids: string[];
	documents: (string | null)[];
	metadatas: (Metadata | null)[];
	scores: number[];
} => {
	const hits: Array<{
		id: string;
		document: string | null;
		metadata: Metadata | null;
		distance: number;
	}> = [];

	// Flatten all results
	for (const result of queryResults) {
		for (let i = 0; i < result.ids.length; i++) {
			const distance = extractDistance(result.distances?.[i]);
			hits.push({
				id: result.ids[i],
				document: result.documents[i] ?? null,
				metadata: result.metadatas[i] ?? null,
				distance: typeof distance === 'number' ? distance : Number.POSITIVE_INFINITY,
			});
		}
	}

	if (!hits.length) {
		return { ids: [], documents: [], metadatas: [], scores: [] };
	}

	// Calculate normalized scores
	const distances = hits.map((h) => h.distance);
	const semanticScores = normalizeSemanticScores(distances);

	const semanticWeight = options?.semanticWeight ?? SEMANTIC_RANKING_CONFIG.WEIGHTS.semantic;
	const recencyWeight = options?.recencyWeight ?? SEMANTIC_RANKING_CONFIG.WEIGHTS.recency;
	const updatedAtField = options?.updatedAtField ?? 'updatedAt';

	// Create ranked results
	const ranked: RankedHit[] = hits.map((hit, i) => {
		const semanticScore = semanticScores[i];
		const recencyScore = calculateRecencyScore((hit.metadata as any)?.[updatedAtField]);
		const combinedScore = semanticWeight * semanticScore + recencyWeight * recencyScore;

		return { ...hit, semanticScore, recencyScore, combinedScore };
	});

	// Sort by combined score (desc) and apply limit
	ranked.sort((a, b) => {
		if (b.combinedScore !== a.combinedScore) return b.combinedScore - a.combinedScore;

		const ta = Date.parse((a.metadata as any)?.[updatedAtField] ?? '');
		const tb = Date.parse((b.metadata as any)?.[updatedAtField] ?? '');
		return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
	});

	const limited = limit ? ranked.slice(0, limit) : ranked;

	return {
		ids: limited.map((h) => h.id),
		documents: limited.map((h) => h.document),
		metadatas: limited.map((h) => h.metadata),
		scores: limited.map((h) => h.combinedScore),
	};
};
