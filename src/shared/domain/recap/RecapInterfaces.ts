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
	loreReferences: string;
	historyReferences: string;
	// Flags for important events in this recap
	flags: string;
}

export interface RecapInfo
	extends Omit<RecapMetadata, 'loreReferences' | 'historyReferences' | 'flags'> {
	// Core content
	content: string;
	// Optional: Cross-references that LLM identified
	loreReferencesArray: Array<{ id: string; relevance: number }>;
	historyReferencesArray: Array<{ id: string; relevance: number }>;

	// Flags for important events in this recap
	flagsArray: string[];
}
