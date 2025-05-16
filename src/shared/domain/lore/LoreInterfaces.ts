import { Metadata } from 'chromadb'; // Alias to avoid confusion if you have your own Metadata type
import { METADATA_TYPES } from '../chromadb/index.ts';

// --- BASE ---
interface BaseLoreHistoryMetadata extends Metadata {
	characterId: string;
	type: typeof METADATA_TYPES.LORE | typeof METADATA_TYPES.HISTORY;
	createdAt: string;
	updatedAt: string;
	keywordsString: string; // Stringified array of keywords (e.g., "keyword1,keyword2")
}

// --- LORE ---
export interface LoreMetadata extends BaseLoreHistoryMetadata {
	loreId: string;
	type: typeof METADATA_TYPES.LORE;
	category: string; // Optional, if used for filtering
	source: string; // Optional, if used for filtering
	// 'keywordsString' is inherited
}

export type LoreInfo = LoreMetadata & {
	content: string; // Full textual content
	keywordsArray: string[]; // The actual array of keywords
};

// --- HISTORY ---
interface TemporalRelationship {
	type: 'precedes' | 'succeeds' | 'concurrent_with' | 'caused_by' | 'results_in';
	relatedEventId: string; // historyId of the related event
	description: string;
}

export interface HistoryMetadata extends BaseLoreHistoryMetadata {
	historyId: string;
	type: typeof METADATA_TYPES.HISTORY;
	title: string; // Optional in metadata, might be long. Full title always in HistoryInfo.
	periodLabel: string;
	periodConfidence: number;
	estimatedEventDateString: string; // For basic string filtering if useful
	dateType: 'absolute_date' | 'estimated_year' | 'relative_to_event' | 'era_defined';
	dateConfidence: number;
	keyThemesString: string; // Stringified array of key themes
	// For temporalRelations, decide if a string version in metadata is useful for filtering.
	// e.g., a string listing relatedEventIds: "histId1,histId2"
	relatedEventIdsString: string;
	sequence: number; // Crucial for ordering timeline events
	// 'keywordsString' is inherited
}

export type HistoryInfo = Omit<
	HistoryMetadata,
	'keywordsString' | 'keyThemesString' | 'relatedEventIdsString' | 'estimatedEventDateString'
> & {
	content: string; // Full textual content of the history event
	keywordsArray: string[]; // Actual array of keywords (if different from keywordsString)
	keyThemesArray: string[]; // Actual array of key themes
	temporalRelations: TemporalRelationship[]; // Full structured temporal relations
	estimatedEventDate: string; // The canonical event date string (could be different from a simplified metadata version)
	title: string; // Make title required in Info if it always exists for a history item
};
