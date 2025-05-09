import { METADATA_TYPES } from '../chromadb/index.ts';

export interface CharacterLore {
	loreId: string;
	characterId: string;
	content: string;
	keyword: string;
	createdAt: string;
	updatedAt: string;
	type: typeof METADATA_TYPES.LORE;
}

export interface CharacterHistory extends Omit<CharacterLore, 'loreId' | 'type'> {
	historyId: string;
	title: string;
	period: string;
	estimatedEventDate: string;
	keyThemes: string[];
	sequence: number;
	type: typeof METADATA_TYPES.HISTORY;
}
