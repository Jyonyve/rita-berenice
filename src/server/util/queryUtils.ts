import { Where } from 'chromadb';

export function isAndWhere(where: Where): where is { $and: Where[] } {
	return where && '$and' in where && Array.isArray((where as any).$and);
}

// Add these constants at the top of chatStore.ts
export const MEMORY_CONFIG = {
	MAX_PREFILTER_TURNS: 100, // Limit pre-filtered results
	RECENT_BIAS_WEIGHT: 0.3, // Weight for recency in scoring
	SEMANTIC_WEIGHT: 0.7, // Weight for semantic similarity
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
