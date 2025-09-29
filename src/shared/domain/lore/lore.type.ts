// src/shared/domain/lore/LoreInterfaces.ts

import { METADATA_TYPES } from '#shared/config/constants.js';

export type LoreIndexContentType =
	| 'AFFECTED_CHARACTER'
	| 'KEYWORD'
	| 'TOPIC'
	| 'ENTITY'
	| 'RELATED_EVENT';

export type LoreCategory =
	| 'World' // NEW: Used exclusively for world lore
	| 'Mythology' // Legends, creation stories, religious beliefs
	| 'Item' // Magical items, artifacts, important objects
	| 'Concept' // Abstract ideas, philosophies, systems
	| 'Organization' // Groups, factions, institutions
	| 'Character' // Important NPCs, legendary figures
	| 'Location' // Places, regions, landmarks
	| 'Event' // Historical events, disasters, celebrations
	| 'Culture' // Customs, traditions, social norms
	| 'Magic' // Spells, magical phenomena, arcane knowledge
	| 'History' // Historical records, timelines
	| 'Technology' // Inventions, crafts, techniques
	| 'Politics' // Government systems, laws, treaties
	| 'Other'; // Fallback for unique cases

// --- 1. PRIMARY DOCUMENT METADATA (Lean, no arrays) ---
interface BaseLoreMetadata {
	loreId: string;
	userId: string;
	createdAt: string;
	updatedAt: string;
	title: string;
	generatedTitle: string;
	summary: string;
	category: LoreCategory; // Now ALL lore has category (world lore uses 'World')
}

// World Lore: Shared world-building content
export interface WorldLoreMetadata extends BaseLoreMetadata {
	type: typeof METADATA_TYPES.WORLD;
	category: 'World'; // Always 'World' for world lore
}

// Misc Lore: Character-specific miscellaneous information
export interface MiscLoreMetadata extends BaseLoreMetadata {
	type: typeof METADATA_TYPES.LORE;
	category: Exclude<LoreCategory, 'World'>; // Any category except 'World'
	source: string;
}

// --- 2. SEARCH INDEX METADATA (Clean, all required fields) ---
export interface LoreIndexMetadata {
	type: typeof METADATA_TYPES.INDEX;
	contentType: LoreIndexContentType;
	loreId: string; // Foreign key to primary lore document
	value: string; // The actual keyword/topic/entity/characterId value
	userId: string; // For user-specific filtering
	category: LoreCategory; // Always present - 'World' for world lore, others for misc lore
	originalCreatedAt: string; // For sorting/filtering by date
}

// --- 3. RICH APPLICATION-LEVEL INTERFACES ---
// World Lore Info: Complete object with reconstructed arrays
export interface WorldLoreInfo extends WorldLoreMetadata {
	content: string; // From document

	// Arrays reconstructed from index records
	characterIds: string[]; // From 'AFFECTED_CHARACTER' index records
	keywordList: string[]; // From 'KEYWORD' index records
	topicList: string[]; // From 'TOPIC' index records
	entityList: string[]; // From 'ENTITY' index records
}

// Misc Lore Info: Complete object with reconstructed arrays
export interface MiscLoreInfo extends MiscLoreMetadata {
	content: string; // From document

	// Arrays reconstructed from index records
	characterIds: string[]; // From 'AFFECTED_CHARACTER' index records
	keywordList: string[]; // From 'KEYWORD' index records
	topicList: string[]; // From 'TOPIC' index records
	entityList: string[]; // From 'ENTITY' index records
}

// --- CDO TYPES ---
export type WorldLoreCdo = Pick<
	WorldLoreInfo,
	'content' | 'title' | 'userId' | 'characterIds' | 'category'
>;
export type MiscLoreCdo = Pick<MiscLoreInfo, 'content' | 'title' | 'userId' | 'characterIds'>;

// Union types for easier handling
export type LoreMetadata = WorldLoreMetadata | MiscLoreMetadata;
export type LoreInfo = WorldLoreInfo | MiscLoreInfo;
export type LoreCdo = WorldLoreCdo | MiscLoreCdo;
