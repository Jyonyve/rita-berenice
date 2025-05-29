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
} from '#shared/index.ts';
import { Collection, Where } from 'chromadb';
import { chromaDbClient } from '../db/index.ts';
import {
	buildFullEntity,
	buildHistoryId,
	buildLoreOrHistoryDocument,
	buildLoreId,
	handleServiceError,
	validateChromaResponse,
	validateServiceId,
} from '../util/index.ts';

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
			const { ids, documents, metadatas } = results;

			// Build full entities using the unified metadata structure
			const lores = buildFullEntity([results]) as LoreInfo[];

			return {
				ids,
				documents,
				metadatas,
				lores,
				loreContents: lores.map((lore) => lore.content),
				lore: lores[0] || null,
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

	/**
	 * Get a single lore entry by ID
	 */
	getLore: async (loreId: string): Promise<LoreResponse> => {
		validateServiceId(loreId, collectionType);
		const collection = await loreService._getCollection();

		try {
			const rawResult = await getRecordById(collection, loreId);
			const results = validateChromaResponse(rawResult, 'getOne', collectionType);
			const lores = buildFullEntity([results]) as LoreInfo[];

			return {
				ids: results.ids,
				documents: results.documents,
				metadatas: results.metadatas,
				lores,
				loreContents: lores.map((lore) => lore.content),
				lore: lores[0] || null,
				loreContent: lores.length > 0 ? lores[0].content : '',
			};
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
				const lores = buildFullEntity([results]) as LoreInfo[];

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

	/**
	 * Store a new lore entry with unified metadata structure
	 */
	storeLore: async (loreInfo: LoreInfo): Promise<void> => {
		const { content, ...loreData } = loreInfo;
		const { characterId } = loreData;
		const now = new Date().toISOString();

		// Create unified metadata structure
		const loreMetadata: LoreMetadata = {
			// Base metadata fields (unified)
			sessionId: loreData.sessionId || '', // May need to be provided or derived
			characterId,
			type: METADATA_TYPES.LORE,
			createdAt: loreData.createdAt || now,
			updatedAt: now,
			keywords: loreData.keywords || '', // Unified array field
			topics: loreData.topics || '', // Unified array field
			entities: loreData.entities || '', // Unified array field
			sequence: loreData.sequence || 0, // May not be applicable for lore

			// Lore-specific fields
			loreId: loreData.loreId || buildLoreId(characterId, now),
			category: loreData.category || 'general',
			source: loreData.source || 'manual',
			title: loreData.title || 'Untitled Lore',
		};

		try {
			const collection = await loreService._getCollection();
			const documentForEmbedding = buildLoreOrHistoryDocument(loreInfo);
			await upsertRecord(collection, loreMetadata.loreId, documentForEmbedding, loreMetadata);

			console.log(
				`[LoreService] Successfully stored lore ${loreMetadata.loreId} for character ${characterId}`
			);
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [storeLore].',
				`Failed to store lore for characterId ${characterId}`
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
			const { ids, documents, metadatas } = results;

			const histories = buildFullEntity([results]) as HistoryInfo[];
			// Sort by sequence for chronological order
			histories.sort((a, b) => a.sequence - b.sequence);

			return {
				ids,
				documents,
				metadatas,
				histories,
				historyContents: histories.map((history) => history.content),
				history: histories[0] || null,
				historyContent: histories.length > 0 ? histories[0].content : '',
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
		const { content, ...historyData } = historyInfo;
		const { characterId } = historyData;
		const now = new Date().toISOString();

		// Create unified metadata structure
		const historyMetadata: HistoryMetadata = {
			// Base metadata fields (unified)
			sessionId: historyData.sessionId || '', // May need to be provided or derived
			characterId,
			type: METADATA_TYPES.HISTORY,
			createdAt: historyData.createdAt || now,
			updatedAt: now,
			keywords: historyData.keywords || '', // Unified array field
			topics: historyData.topics || '', // Unified array field
			entities: historyData.entities || '', // Unified array field
			sequence: historyData.sequence || 0,

			// History-specific fields (unified structure)
			historyId: historyData.historyId || buildHistoryId(characterId, now),
			title: historyData.title || 'Untitled Event',
			period: historyData.period || { label: 'Unknown', confidence: 0.5 },
			eventDate: historyData.eventDate || { value: 'Unknown', type: 'era_defined', confidence: 0.5 },
			relatedEvents: historyData.relatedEvents || [],
		};

		try {
			const collection = await loreService._getCollection();
			const documentForEmbedding = buildLoreOrHistoryDocument(historyInfo);
			await upsertRecord(collection, historyMetadata.historyId, documentForEmbedding, historyMetadata);

			console.log(
				`[LoreService] Successfully stored history ${historyMetadata.historyId} for character ${characterId}`
			);
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [storeHistory].',
				`Failed to store history for characterId ${characterId}`
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
