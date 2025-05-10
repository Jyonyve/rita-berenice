import { METADATA_TYPES } from '../chromadb/index.ts';

export interface CharacterLore {
	loreId: string;
	characterId: string;
	content: string;
	keywords: string[];
	createdAt: string;
	updatedAt: string;
	type: typeof METADATA_TYPES.LORE;
}

export interface CharacterHistory extends Omit<CharacterLore, 'loreId' | 'type'> {
	historyId: string;
	title: string;
	periodLabel: string;
	periodConfidence: number;
	estimatedEventDate: string;
	dateType: 'absolute' | 'relative' | 'era';
	dateConfidence: number;
	keyThemes: string[];
	temporalRelations: string[];
	sequence: string;
	type: typeof METADATA_TYPES.HISTORY;
}
