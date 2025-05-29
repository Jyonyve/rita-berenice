import { BaseMetadataType } from '../chat/index.ts';
import { METADATA_TYPES } from '../chromadb/index.ts';

// --- RECAP METADATA ---
export interface RecapMetadata extends BaseMetadataType {
	recapId: string;
	type: typeof METADATA_TYPES.RECAP | typeof METADATA_TYPES.RELATIONSHIP;

	// Recap-specific fields
	turnStart: number; // Flattened from turnRange.start
	turnEnd: number; // Flattened from turnRange.end
	model: string; // Which LLM generated this recap
}

export interface RecapInfo extends RecapMetadata {
	content: string;
}
// src/shared/domain/RecapInterfaces.ts

export interface RecapResult {
	// Core content
	content: string;

	// Metadata extracted/refined by LLM
	keywords: string[];
	topics: string[];
	entities: string[];

	// Turn information (flattened)
	turnStart: number; // Changed from turnRange.start
	turnEnd: number; // Changed from turnRange.end
	sessionId: string;

	// Optional: Model used for generation
	model: string;

	// Optional: Cross-references that LLM identified
	loreReferences?: Array<{ id: string; relevance: number }>;
	historyReferences?: Array<{ id: string; relevance: number }>;

	// Flags for important events in this recap
	flags?: string[];
}
