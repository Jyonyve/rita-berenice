// src/server/services/loreService.ts

import {
	LoreInfo,
	HistoryInfo,
	LoreMetadata,
	HistoryMetadata,
	LoreResponse,
	HistoryResponse,
	COLLECTIONS,
	METADATA_TYPES,
	ChromaResponse,
} from '#shared/index.ts';
import { Collection, Where } from 'chromadb';
import { chromaDbClient } from '../db/index.ts';
import {
	buildHistoryId,
	flatLoreOrHistoryToDoc,
	buildLoreId,
	handleServiceError,
	validateChromaResponse,
	validateServiceId,
	inflateLoreOrHistoryDoc,
} from '../util/index.ts';
import {
	metadataToHistory,
	metadataToLore,
	historyToMetadata,
	loreToMetadata,
} from '#shared/util/dbConvertUtils.ts';

// Destructure chromaDbClient methods
const { getLoreCollection, upsertRecord, getRecords, getRecordById, queryRecords } = chromaDbClient;
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

	_constuctLore: (results: ChromaResponse): LoreResponse => {
		const { ids, documents, metadatas } = results;
		const lores = ids.map((id, index) => {
			const metadata = metadatas[index] as unknown as LoreMetadata;
			const document = documents[index];
			const inflatedDoc = inflateLoreOrHistoryDoc(document!);
			return metadataToLore(metadata, inflatedDoc.content);
		});
		return {
			ids,
			documents,
			metadatas,
			lores,
			lore: lores[0] || null,
			loreContent: lores.length > 0 ? lores[0].content : '',
			loreContents: lores.map((lore) => lore.content),
		};
	},

	_constuctHistory: (results: ChromaResponse): HistoryResponse => {
		const { ids, documents, metadatas } = results;
		const histories = ids.map((id, index) => {
			const metadata = metadatas[index] as unknown as HistoryMetadata;
			const document = documents[index];
			const inflatedDoc = inflateLoreOrHistoryDoc(document!);
			return metadataToHistory(metadata!, inflatedDoc.content);
		});
		return {
			ids,
			documents,
			metadatas,
			histories,
			history: histories[0] || null,
			historyContent: histories.length > 0 ? histories[0].content : '',
			historyContents: histories.map((history) => history.content),
		};
	},

	// --- LORE OPERATIONS ---
	/**
	 * Get all lore entries for a specific character
	 */
	getLores: async (characterId: string): Promise<LoreResponse> => {
		validateServiceId(characterId, collectionType);
		const collection = await loreService._getCollection();
		const where: Where = {
			$and: [{ type: { $eq: METADATA_TYPES.LORE } }, { characterId: { $eq: characterId } }],
		};

		try {
			const rawResults = await getRecords(collection, where);
			const results = validateChromaResponse(rawResults, 'getList', collectionType);
			// Build full entities using the unified metadata structure
			return loreService._constuctLore(results);
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [getLores].',
				`Failed to get lores for characterId ${characterId}`
			);
		}
	},

	/**
	 * Get a single lore entry by ID
	 */
	getLore: async (loreId: string): Promise<LoreResponse> => {
		validateServiceId(loreId, collectionType);
		const collection = await loreService._getCollection();

		try {
			const rawResult = await getRecordById(collection, loreId);
			const results = validateChromaResponse(rawResult, 'getOne', collectionType);
			return loreService._constuctLore(results);
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [getLore].',
				`Failed to get lore with ID ${loreId}`
			);
		}
	},

	/**
	 * Query lore entries using semantic search and metadata filters
	 */
	queryLores: async (
		characterId: string,
		queryTexts: string[],
		options?: { categories?: string[]; keywords?: string[]; topics?: string[]; limit?: number }
	): Promise<LoreResponse> => {
		validateServiceId(characterId, collectionType);
		const collection = await loreService._getCollection();

		// Build where clause with unified metadata structure
		const whereConditions: Where[] = [
			{ type: { $eq: METADATA_TYPES.LORE } },
			{ characterId: { $eq: characterId } },
		];

		if (!!options) {
			const { categories, keywords, topics } = options;
			categories?.length && whereConditions.push({ category: { $in: categories } });
			keywords?.length && whereConditions.push({ keywords: { $in: keywords } });
			topics?.length && whereConditions.push({ topics: { $in: topics } });
		}

		const whereClause: Where = { $and: whereConditions };

		try {
			const rawResults = await queryRecords(
				collection,
				queryTexts,
				whereClause,
				undefined,
				options?.limit
			);

			// Handle array of results from queryRecords
			const allLores: LoreInfo[] = [];
			const allIds: string[] = [];
			const allDocuments: (string | null)[] = [];
			const allMetadatas: (any | null)[] = [];

			for (const rawResult of rawResults) {
				const results = validateChromaResponse(rawResult, 'getList', collectionType);
				const lores = loreService._constuctLore(results).lores;

				allLores.push(...lores);
				allIds.push(...results.ids);
				allDocuments.push(...results.documents);
				allMetadatas.push(...results.metadatas);
			}

			return {
				ids: allIds,
				documents: allDocuments,
				metadatas: allMetadatas,
				lores: allLores,
				loreContents: allLores.map((lore) => lore.content),
				lore: allLores[0] || null,
				loreContent: allLores.length > 0 ? allLores[0].content : '',
			};
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [queryLores].',
				`Failed to query lores for characterId ${characterId}`
			);
		}
	},

	queryHistories: async (
		characterId: string,
		queryTexts: string[],
		options?: { limit?: number }
	): Promise<HistoryResponse> => {
		validateServiceId(characterId, collectionType);
		const collection = await loreService._getCollection();

		// Build where clause with unified metadata structure
		const whereClause: Where = {
			$and: [{ type: { $eq: METADATA_TYPES.HISTORY } }, { characterId: { $eq: characterId } }],
		};

		try {
			const rawResults = await queryRecords(
				collection,
				queryTexts,
				whereClause,
				undefined,
				options?.limit
			);

			// This logic can be simplified if queryRecords returns a single structured response
			// Assuming it returns an array of results for each queryText
			const allHistories: HistoryInfo[] = [];
			const allIds: string[] = [];
			const allDocuments: (string | null)[] = [];
			const allMetadatas: (any | null)[] = [];

			for (const rawResult of rawResults) {
				const results = validateChromaResponse(rawResult, 'getList', collectionType);
				const histories = loreService._constuctHistory(results).histories;
				allHistories.push(...histories);
				allIds.push(...results.ids);
				allDocuments.push(...results.documents);
				allMetadatas.push(...results.metadatas);
			}

			// De-duplicate results if necessary and return a standard HistoryResponse
			const uniqueHistories = Array.from(new Map(allHistories.map((h) => [h.historyId, h])).values());

			return {
				// Construct a valid HistoryResponse object
				ids: allIds,
				documents: allDocuments,
				metadatas: allMetadatas,
				histories: uniqueHistories,
				history: uniqueHistories[0] || null,
				historyContents: uniqueHistories.map((h) => h.content),
				historyContent: uniqueHistories[0]?.content || '',
			};
		} catch (error) {
			handleServiceError(
				error,
				`An internal error occurred while doing [queryHistories].`,
				`Failed to query histories for characterId: ${characterId}`
			);
		}
	},

	/**
	 * Store a new lore entry with unified metadata structure
	 */
	storeLore: async (loreInfo: LoreInfo): Promise<void> => {
		const now = new Date().toISOString();

		const loreMetadata: LoreMetadata = {
			...loreToMetadata(loreInfo),
			loreId: loreInfo.loreId || buildLoreId(loreInfo.englishId),
			createdAt: loreInfo.createdAt || now,
			type: METADATA_TYPES.LORE,
			updatedAt: now,
		};
		try {
			const collection = await loreService._getCollection();
			const documentForEmbedding = flatLoreOrHistoryToDoc(loreInfo);
			await upsertRecord(collection, loreMetadata.loreId, documentForEmbedding, loreMetadata);

			console.log(
				`[LoreService] Successfully stored lore ${loreMetadata.loreId} for character ${loreMetadata.characterId}`
			);
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [storeLore].',
				`Failed to store lore for characterId ${loreMetadata.characterId}`
			);
		}
	},

	// --- HISTORY OPERATIONS ---

	/**
	 * Get all history entries for a specific character
	 */
	getHistories: async (characterId: string): Promise<HistoryResponse> => {
		validateServiceId(characterId, collectionType);
		const collection = await loreService._getCollection();
		const where: Where = {
			$and: [{ type: { $eq: METADATA_TYPES.HISTORY } }, { characterId: { $eq: characterId } }],
		};

		try {
			const rawResults = await getRecords(collection, where);
			const results = validateChromaResponse(rawResults, 'getList', collectionType);
			const historyInfos = loreService._constuctHistory(results);
			// Sort by sequence for chronological order
			const sorted = historyInfos.histories.sort((a, b) => a.sequence - b.sequence);

			return {
				...historyInfos,
				historyContents: sorted.map((history) => history.content),
				history: sorted[0] || null,
				historyContent: sorted.length > 0 ? sorted[0].content : '',
			};
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [getHistories].',
				`Failed to get histories for characterId ${characterId}`
			);
		}
	},

	/**
	 * Store a new history entry with unified metadata structure
	 */
	storeHistory: async (historyInfo: HistoryInfo): Promise<void> => {
		const now = new Date().toISOString();
		const historyMetadata: HistoryMetadata = {
			...historyToMetadata(historyInfo),
			historyId: historyInfo.historyId || buildHistoryId(historyInfo.englishId),
			createdAt: historyInfo.createdAt || now,
			type: METADATA_TYPES.HISTORY,
			updatedAt: now,
		};
		try {
			const collection = await loreService._getCollection();
			const documentForEmbedding = flatLoreOrHistoryToDoc(historyInfo);
			await upsertRecord(collection, historyMetadata.historyId, documentForEmbedding, historyMetadata);

			console.log(
				`[LoreService] Successfully stored history ${historyMetadata.historyId} for character ${historyInfo.characterId}`
			);
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [storeHistory].',
				`Failed to store history for characterId ${historyInfo.characterId}`
			);
		}
	},

	// --- UTILITY METHODS ---

	/**
	 * Clear collection cache
	 */
	clearCollectionCache: (): void => {
		console.log('[LoreService] Clearing cached lore collection.');
		loreService._loreCollection = null;
	},
};
