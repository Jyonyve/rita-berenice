// src/server/service/loreService.ts

import {
	CharacterHistory,
	CharacterLore,
	COLLECTIONS,
	METADATA_TYPES,
} from '#root/src/shared/index.ts'; // Adjust path
import { Collection, Where } from 'chromadb';
import {
	buildHistoryDocument,
	buildHistoryId,
	buildLoreDocument,
	buildLoreId,
} from '../util/index.ts';
import { chromaDbClient } from '../db/index.ts';

const { getLoreCollection, upsertRecord, getRecords } = chromaDbClient;

export const loreService = {
	// Cache for lore collection
	_loreCollection: null as Collection | null,

	_getCollection: async (): Promise<Collection> => {
		if (loreService._loreCollection) {
			return loreService._loreCollection;
		}
		const collection = await getLoreCollection();
		loreService._loreCollection = collection;
		return collection;
	},

	_parseMetadataToLores: (metadatas: (Record<string, any> | null)[]): CharacterLore[] => {
		return metadatas.filter((meta): meta is CharacterLore => meta?.type === METADATA_TYPES.LORE);
	},

	_parseMetadataToHistories: (metadatas: (Record<string, any> | null)[]): CharacterHistory[] => {
		return metadatas.filter(
			(meta): meta is CharacterHistory => meta?.type === METADATA_TYPES.HISTORY
		);
	},

	// --- Get a lores by character ID ---
	getLores: async (characterId: string, limit = -1): Promise<LoreChromaResponse | null> => {
		validateServiceId(characterId, COLLECTIONS.LORE); // Ensure characterId is valid
		const collection = await loreService._getCollection();
		try {
			console.log(`[LoreService] Querying Lores for characterId: ${characterId}`);
			const whereClause: Where = { type: METADATA_TYPES.LORE, characterId };
			const results = await getRecords(collection, whereClause, limit);

			if (validateResult(results)) {
				const { ids, documents, metadatas } = results;
				const parsedLores = loreService._parseMetadataToLores(metadatas);
				return {
					ids,
					documents,
					metadatas,
					lores: parsedLores,
					loreContents: parsedLores.map((lore) => lore.content),
					historyContents: [],
					histrories: [],
				};
			}
			console.warn(`failed to getLores, characterId : ${characterId}`);
			return null;
		} catch (error) {
			console.error(`Failed to get lores with ID ${characterId}:`, error);
			return null;
		}
	},

	// --- Get all history for a specific character, optionally filtered by type ---
	getHistories: async (characterId: string, limit = -1): Promise<LoreChromaResponse | null> => {
		validateServiceId(characterId, COLLECTIONS.LORE); // Ensure characterId is valid
		const collection = await loreService._getCollection();
		try {
			console.log(`[LoreService] Querying Lores for characterId: ${characterId}`);
			const whereClause: Where = { type: METADATA_TYPES.HISTORY, characterId };
			const results = await getRecords(collection, whereClause, limit);

			if (validateResult(results)) {
				const { ids, documents, metadatas } = results;
				const parsedHistories = loreService._parseMetadataToHistories(metadatas);
				return {
					ids,
					documents,
					metadatas,
					lores: [],
					loreContents: [],
					historyContents: parsedHistories.map((history) => history.content),
					histrories: parsedHistories,
				};
			}
			console.warn(`failed to getHistories, characterId : ${characterId}`);
			return null;
		} catch (error) {
			console.error(`Failed to get histories with ID ${characterId}:`, error);
			return null;
		}
	},

	// --- Store a new piece of lore ---
	storeLore: async (lore: CharacterLore): Promise<void> => {
		const { characterId, createdAt } = lore;
		const collection = await loreService._getCollection();
		lore.loreId = buildLoreId(characterId, createdAt);
		const documentForEmbedding = buildLoreDocument(lore);
		await upsertRecord(collection, lore.loreId, documentForEmbedding, lore);
	},

	// --- Store a new piece of history ---
	storeHistory: async (history: CharacterHistory): Promise<void> => {
		const { characterId, createdAt } = history;
		const collection = await loreService._getCollection();
		history.historyId = buildHistoryId(characterId, createdAt);
		const documentForEmbedding = buildHistoryDocument(history);
		await upsertRecord(collection, history.historyId, documentForEmbedding, history);
	},

	clearCollectionCache: (): void => {
		console.log('[LoreService.clearCollectionCache] Clearing cached lore collection.');
		loreService._loreCollection = null;
	},
};
