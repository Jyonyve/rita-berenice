// src/shared/domain/lore/LoreInterfaces.ts

import { METADATA_TYPES } from '#shared/config/constants.js';
import { RelatedEvent } from '../BaseTypes.js';

export type EventDateType =
	| 'absolute_date'
	| 'estimated_year'
	| 'relative_to_event'
	| 'era_defined';

export type LoreIndexContentType = 'AFFECTED_CHARACTER' | 'KEYWORD' | 'TOPIC' | 'RELATED_EVENT';

// --- A. THE PRIMARY DOCUMENT INTERFACES ---

/**
 * Metadata for a primary LORE document stored in ChromaDB.
 * This document contains the main content for semantic search.
 */
export interface LoreMetadata {
	type: typeof METADATA_TYPES.LORE;
	loreId: string;
	characterId: string;
	userId: string;
	profileId: string;
	createdAt: string;
	updatedAt: string;
	title: string;
	generatedTitle: string;
	englishId: string;
	category: string;
	source: string;
	summary: string;
}

/**
 * Metadata for a primary HISTORY document stored in ChromaDB.
 * This document contains the main content for semantic search.
 */
export interface HistoryMetadata {
	type: typeof METADATA_TYPES.HISTORY;
	historyId: string;
	characterId: string;
	userId: string;
	profileId: string;
	createdAt: string;
	updatedAt: string;
	title: string;
	generatedTitle: string;
	englishId: string;
	category: string;
	summary: string;
	periodLabel: string;
	eventDateValue: string;
	eventDateType: EventDateType;
}

// --- B. THE UNIFIED SEARCH INDEX INTERFACE ---

/**
 * A single, unified metadata structure for all denormalized search index entries.
 * These records are lightweight and designed for fast, precise filtering.
 */
export interface LoreIndexMetadata {
	// The type of the parent document (LORE or HISTORY)
	type: typeof METADATA_TYPES.INDEX;

	// What kind of attribute this index entry represents
	contentType: LoreIndexContentType;

	// Foreign key to the parent document
	contentId: string;

	// The indexed value
	value: string;

	// The primary owner's ID for broad filtering
	characterId: string;
}

// --- C. THE RICH, APPLICATION-LEVEL INTERFACES ---

/**
 * The rich object your application works with for Lore.
 * The service layer is responsible for reconstructing the arrays from the search index.
 */
export interface LoreInfo extends LoreMetadata {
	content: string;
	sideCharacterIdList: string[];
	allAffectedCharacterIdList: string[];
	keywordList: string[];
	topicList: string[];
}

export interface HistoryInfo extends HistoryMetadata {
	content: string;
	sideCharacterIdList: string[];
	allAffectedCharacterIdList: string[];
	relatedEventList: RelatedEvent[];
	keywordList: string[];
}

// --- CDO TYPES ---
export type HistoryCdo = Pick<HistoryInfo, 'content' | 'title' | 'userId' | 'characterId'>;
export type LoreCdo = Pick<LoreInfo, 'content' | 'userId' | 'characterId'>;
