import { BaseMetadataType } from '../chat/index.ts';
import { METADATA_TYPES } from '../chromadb/index.ts';

// --- RECAP METADATA ---
export interface RecapMetadata extends BaseMetadataType {
	recapId: string;
	type: typeof METADATA_TYPES.RECAP | typeof METADATA_TYPES.RELATIONSHIP;
	recapType: 'factual' | 'relationship'; // Explicit type

	// Recap-specific fields
	turnRange: { start: number; end: number };
	model: string; // Which LLM generated this recap
}

export interface RecapInfo extends RecapMetadata {
	content: string;
}
