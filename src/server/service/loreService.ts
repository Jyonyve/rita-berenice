// src/server/service/loreService.ts

import {
	LoreInfo,
	HistoryInfo,
	COLLECTIONS,
	METADATA_TYPES,
	LoreResponse,
	HistoryResponse,
	LoreMetadata,
	HistoryMetadata,
} from '#root/src/shared/index.ts'; // Adjust path
import { Collection, Where } from 'chromadb';
import {
	buildFullEntity,
	buildHistoryDocument,
	buildHistoryId,
	buildLoreDocument,
	buildLoreId,
	handleServiceError,
	validateChromaResponse,
	validateServiceId,
} from '../util/index.ts';
import { chromaDbClient } from '../db/index.ts';
import { build } from 'vite';

const { getLoreCollection, upsertRecord, getRecords } = chromaDbClient;
const collectionType = COLLECTIONS.LORE;

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

	_parseResponseToLores: (metadatas: (Record<string, any> | null)[]): LoreInfo[] => {
		return metadatas.filter((meta): meta is LoreInfo => meta?.type === METADATA_TYPES.LORE);
	},

	_parseResponseToHistories: (metadatas: (Record<string, any> | null)[]): HistoryInfo[] => {
		return metadatas.filter((meta): meta is HistoryInfo => meta?.type === METADATA_TYPES.HISTORY);
	},

	// --- Get a lores by character ID ---
	getLores: async (characterId: string): Promise<LoreResponse> => {
		validateServiceId(characterId, COLLECTIONS.LORE); // Ensure characterId is valid
		const collection = await loreService._getCollection();
		const where: Where = {
			$and: [{ type: { $eq: METADATA_TYPES.LORE } }, { characterId: { $eq: characterId } }],
		};
		try {
			const rawResults = await getRecords(collection, where);
			const results = validateChromaResponse(rawResults, 'getList', collectionType);
			const lores = buildFullEntity([results]) as LoreInfo[];
			const { ids, documents, metadatas } = results;

			return {
				ids,
				documents,
				metadatas,
				lores: lores,
				loreContents: lores.map((lore) => lore.content),
				lore: lores[0],
				loreContent: lores.length > 0 ? lores[0].content : '',
			};
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [getLores].',
				`Failed to get lores for characterId ${characterId}`
			);
		}
	},

	// --- Get all history for a specific character, optionally filtered by type ---
	getHistories: async (characterId: string): Promise<HistoryResponse> => {
		validateServiceId(characterId, COLLECTIONS.LORE); // Ensure characterId is valid
		const collection = await loreService._getCollection();
		const where: Where = {
			$and: [{ type: { $eq: METADATA_TYPES.HISTORY } }, { characterId: { $eq: characterId } }],
		};
		try {
			const rawResults = await getRecords(collection, where);
			const results = validateChromaResponse(rawResults, 'getList', collectionType);
			const histories = buildFullEntity([results]) as HistoryInfo[];
			const { ids, documents, metadatas } = results;
			return {
				ids,
				documents,
				metadatas,
				histories,
				historyContents: histories.map((history) => history.content),
				history: histories[0],
				historyContent: histories.length > 0 ? histories[0].content : '',
			};
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [getLores].',
				`Failed to get lores for characterId ${characterId}`
			);
		}
	},

	// --- Store a new piece of lore ---
	storeLore: async (lore: LoreInfo): Promise<void> => {
		const { content, keywordsArray, ...loreMetadata } = lore;
		const { characterId, loreId } = loreMetadata;
		const now = new Date().toISOString();

		const updatedMetadata: LoreMetadata = {
			...loreMetadata,
			loreId: loreId || buildLoreId(characterId, now),
			createdAt: lore.createdAt || now,
			updatedAt: now,
			type: METADATA_TYPES.LORE,
		};
		try {
			const collection = await loreService._getCollection();
			const documentForEmbedding = buildLoreDocument(lore);
			await upsertRecord(collection, updatedMetadata.loreId, documentForEmbedding, updatedMetadata);
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [storeLore].',
				`Failed to store lore for characterId ${characterId}:`
			);
		}
	},

	// --- Store a new piece of history ---
	storeHistory: async (history: HistoryInfo): Promise<void> => {
		const { content, keywordsArray, keyThemesArray, temporalRelations, title, ...historyMetadata } =
			history;
		const { characterId, historyId } = historyMetadata;
		const now = new Date().toISOString();

		const updatedMetadata: HistoryMetadata = {
			...historyMetadata,
			historyId: historyId || buildHistoryId(characterId, now),
			createdAt: history.createdAt || now,
			updatedAt: now,
			type: METADATA_TYPES.HISTORY,
		};
		try {
			const collection = await loreService._getCollection();
			const documentForEmbedding = buildHistoryDocument(history);
			await upsertRecord(collection, updatedMetadata.historyId, documentForEmbedding, updatedMetadata);
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [storeHistory].',
				`Failed to store history for characterId ${characterId}:`
			);
		}
	},

	clearCollectionCache: (): void => {
		console.log('[LoreService.clearCollectionCache] Clearing cached lore collection.');
		loreService._loreCollection = null;
	},
};
