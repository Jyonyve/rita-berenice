// src/shared/domain/lore/LoreInterfaces.ts
import { METADATA_TYPES } from '#shared/config/constants.js';
import { BaseMetadataType } from '../chat/ChatInterfaces.js';

// --- LORE METADATA (ChromaDB-compatible) ---
export interface LoreMetadata extends Omit<BaseMetadataType, 'sessionId'> {
	loreId: string;
	type: typeof METADATA_TYPES.LORE;
	category: string;
	source: string; // ✅ Added missing source field
	summary: string;
	title: string;
	generatedTitle: string; // Auto-generated title based on content
	englishId: string; // kebab-case version of the title summary

	// Character ownership and involvement (flattened for ChromaDB)
	ownerCharacterIds: string; // "tarion_original,tarion_spinoff" - who owns this story
	sideCharacterIds: string; // "kassar_original,kassar_spinoff,prince_vargas" - who appears in the story
	allAffectedCharacterIds: string; // Combined for easy querying: "tarion_original,tarion_spinoff,kassar_original,kassar_spinoff"
}

export interface LoreInfo
	extends Omit<LoreMetadata, 'ownerCharacterIds' | 'sideCharacterIds' | 'allAffectedCharacterIds'> {
	content: string;

	// Rich arrays for application use (parsed from ChromaDB strings)
	ownerCharacterIdArray: string[]; // ["tarion_original", "tarion_spinoff"]
	sideCharacterIdArray: string[]; // ["kassar_original", "kassar_spinoff"]
	allAffectedCharacterIdArray: string[]; // Combined array for convenience
}

// --- HISTORY METADATA (ChromaDB-compatible - all primitives) ---
export interface HistoryMetadata extends Omit<BaseMetadataType, 'sessionId'> {
	historyId: string;
	type: typeof METADATA_TYPES.HISTORY;
	title: string;
	generatedTitle: string;
	englishId: string; // kebab-case version of the title summary
	category: string; // ✅ Added category field for consistency
	summary: string;

	// Character ownership and involvement (flattened for ChromaDB)
	ownerCharacterIds: string; // "tarion_original,tarion_spinoff" - whose memory/perspective this is
	sideCharacterIds: string; // "kassar_original,kassar_spinoff" - who else is involved
	allAffectedCharacterIds: string; // Combined for easy querying

	// Temporal information (flattened for ChromaDB)
	periodLabel: string;
	periodConfidence: number; // 0.0 to 1.0
	eventDateValue: string;
	eventDateType: 'absolute_date' | 'estimated_year' | 'relative_to_event' | 'era_defined';
	eventDateConfidence: number;

	// Relationships (stringified for ChromaDB)
	relatedEvents: string; // JSON.stringify(Array<{id, relationship, description}>)
}

export interface HistoryInfo
	extends Omit<
		HistoryMetadata,
		'relatedEvents' | 'ownerCharacterIds' | 'sideCharacterIds' | 'allAffectedCharacterIds'
	> {
	content: string;

	// Rich objects for application use (parsed from flattened fields)
	ownerCharacterIdArray: string[]; // ["tarion_original", "tarion_spinoff"]
	sideCharacterIdArray: string[]; // ["kassar_original", "kassar_spinoff"]
	allAffectedCharacterIdArray: string[]; // Combined array

	// Parsed relationships
	relatedEventsArray: Array<{
		id: string;
		relationship: 'precedes' | 'succeeds' | 'concurrent_with' | 'caused_by' | 'results_in';
		description: string;
	}>;
}

// --- CDO TYPES ---
export type HistoryCdo = Pick<HistoryInfo, 'content' | 'title' | 'userId' | 'characterId'>;
export type LoreCdo = Pick<LoreInfo, 'content' | 'userId' | 'characterId'>;
