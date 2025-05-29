import { METADATA_TYPES } from '../chromadb/index.ts';
import { BaseMetadataType } from '../chat/index.ts';

// --- BASE ---
export interface LoreMetadata extends BaseMetadataType {
	loreId: string;
	type: typeof METADATA_TYPES.LORE;
	category: string;
	source: string;
	title: string; // Added for consistency
}

export interface LoreInfo extends LoreMetadata {
	content: string;
}

// --- HISTORY METADATA ---
export interface HistoryMetadata extends BaseMetadataType {
	historyId: string;
	type: typeof METADATA_TYPES.HISTORY;
	title: string;

	// Temporal information (unified structure)
	period: {
		label: string;
		confidence: number; // 0.0 to 1.0
	};
	eventDate: {
		value: string;
		type: 'absolute_date' | 'estimated_year' | 'relative_to_event' | 'era_defined';
		confidence: number;
	};

	// Relationships (simplified)
	relatedEvents: Array<{
		id: string; // historyId of related event
		relationship: 'precedes' | 'succeeds' | 'concurrent_with' | 'caused_by' | 'results_in';
		description: string;
	}>;
}

export interface HistoryInfo extends HistoryMetadata {
	content: string;
}
