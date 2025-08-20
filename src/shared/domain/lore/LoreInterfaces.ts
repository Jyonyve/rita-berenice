// src/shared/domain/lore/LoreInterfaces.ts

import { METADATA_TYPES } from '#shared/config/constants.js';
import { RelatedEvent } from '../BaseTypes.js';

export type EventDateType =
	| 'absolute_date'
	| 'estimated_year'
	| 'relative_to_event'
	| 'era_defined';
export type LoreIndexContentType =
	| 'AFFECTED_CHARACTER'
	| 'KEYWORD'
	| 'TOPIC'
	| 'ENTITY'
	| 'RELATED_EVENT';
export type LoreCategory =
	| 'Mythology' // Legends| creation stories| religious beliefs
	| 'Item' // Magical items| artifacts| important objects
	| 'Concept' // Abstract ideas| philosophies| systems
	| 'Organization' // Groups| factions| institutions
	| 'Character' // Important NPCs| legendary figures
	| 'Location' // Places| regions| landmarks
	| 'Event' // Historical events| disasters| celebrations
	| 'Culture' // Customs| traditions| social norms
	| 'Magic' // Spells| magical phenomena| arcane knowledge
	| 'History' // Historical records| timelines
	| 'Technology' // Inventions| crafts| techniques
	| 'Politics' // Government systems| laws| treaties
	| 'Other'; // Fallback for unique cases
export type HistoryCategory =
	| 'Origin Story'
	| 'Major Life Event'
	| 'Relationship Turnpoint'
	| 'Career & Faction'
	| 'Conflict & War'
	| 'Internal Struggle'
	| 'Other';

// --- A. PRIMARY DOCUMENT METADATA ---
export interface LoreMetadata {
	type: typeof METADATA_TYPES.LORE;
	loreId: string;
	characterId: string; // The primary owner
	userId: string;
	profileId: string;
	createdAt: string;
	updatedAt: string;
	title: string;
	generatedTitle: string;
	category: LoreCategory;
	source: string;
	summary: string;
}

export interface HistoryMetadata {
	type: typeof METADATA_TYPES.HISTORY;
	historyId: string;
	characterId: string; // The primary owner
	userId: string;
	profileId: string;
	createdAt: string;
	updatedAt: string;
	title: string;
	generatedTitle: string;
	category: HistoryCategory;
	summary: string;
	periodLabel: string;
	eventDateValue: string;
	eventDateType: EventDateType;
}

// --- B. UNIFIED SEARCH INDEX METADATA ---
export interface LoreIndexMetadata {
	type: typeof METADATA_TYPES.INDEX;
	contentType: LoreIndexContentType;
	contentId: string; // Foreign key to Lore or History document
	value: string;
	characterId: string;
}

// --- C. RICH APPLICATION-LEVEL INTERFACES ---
export interface LoreInfo extends LoreMetadata {
	content: string;
	sideCharacterIdList: string[];
	allAffectedCharacterIdList: string[];
	keywordList: string[];
	topicList: string[];
	entityList: string[]; // Added for consistency
}

export interface HistoryInfo extends HistoryMetadata {
	content: string;
	sideCharacterIdList: string[];
	allAffectedCharacterIdList: string[];
	relatedEventList: RelatedEvent[];
	keywordList: string[];
	topicList: string[]; // Added for consistency
	entityList: string[]; // Added for consistency
}

// --- CDO TYPES ---
export type HistoryCdo = Pick<HistoryInfo, 'content' | 'title' | 'userId' | 'characterId'>;
export type LoreCdo = Pick<LoreInfo, 'content' | 'userId' | 'characterId'>;

//---- context object ----

// For your history context
export interface HistoryContext {
	historyId: string; // The ID to be returned
	title: string; // The human-readable title
	summary: string; // A concise summary of the event
	category: HistoryCategory; // The event's classification
	periodLabel: string; // The life period this event belongs to
	keywordList: string[]; // Specific search terms
	topicList: string[]; // Broader thematic concepts
	entityList: string[]; // Specific named people| places| things
	allAffectedCharacterIdList: string[];
}

// A similar one for Lore
export interface LoreContext {
	loreId: string;
	title: string;
	summary: string;
	category: LoreCategory;
	keywordList: string[];
	topicList: string[];
	entityList: string[];
	allAffectedCharacterIdList: string[];
}
