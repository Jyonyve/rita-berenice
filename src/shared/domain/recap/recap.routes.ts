// src/shared/domain/recap/RecapInterfaces.ts (or your equivalent file)

import { METADATA_TYPES } from '#shared/config/constants.js';
import { Reference } from '../BaseTypes.js';

export type RecapIndexContentType = 'RECAP_FLAG';

// --- 1. The Primary Document Metadata ---
/**
 * Metadata for a primary RECAP or RELATIONSHIP document stored in ChromaDB.
 * This document contains the main content for semantic search.
 * All array-like fields intended for filtering have been removed.
 */
export interface RecapMetadata {
	type: typeof METADATA_TYPES.RECAP | typeof METADATA_TYPES.RELATIONSHIP;
	recapId: string;
	sessionId: string;
	characterId: string;
	userId: string;
	profileId: string;
	createdAt: string;
	updatedAt: string;
	turnStart: number;
	turnEnd: number;
	model: string;
	loreReferenceList: string;
	historyReferenceList: string;
}

// --- 2. The Search Index Metadata ---
/**
 * A dedicated metadata structure for Recap-related search index entries.
 * A new record of this type is created for every single flag associated with a Recap.
 */
export interface RecapIndexMetadata {
	// The type of the parent document
	type: typeof METADATA_TYPES.INDEX;

	// What kind of attribute this index entry represents
	contentType: RecapIndexContentType;

	// Foreign key to the parent Recap document
	recapId: string;

	// The indexed value (e.g., "major_plot_point")
	value: string;

	// Core identifiers for broad filtering
	sessionId: string;
	characterId: string;
}

// --- 3. The Application-Level Rich Object ---
/**
 * The rich object your application works with for Recaps.
 * The service layer is responsible for fetching the main RecapMetadata
 * and then querying the index for all RECAP_FLAG records matching the recapId
 * to reconstruct the flagsArray.
 */
export interface RecapInfo
	extends Omit<RecapMetadata, 'loreReferenceList' | 'historyReferenceList'> {
	content: string;
	flagList: string[];
	loreReferenceList: Reference[];
	historyReferenceList: Reference[];
}
