// src/server/services/loreStore.ts
import { Collection, Where, WhereDocument } from 'chromadb';

import { METADATA_TYPES } from '#shared/config/constants.js';
import { COLLECTIONS } from '../db/ChromaInterfaces.js';
import { chromaDbClient } from '../db/chromaDbClient.js';
import { ChromaResponse, HistoryResponse, LoreResponse } from '#shared/api/ModuleResponse.js';
import { flatLoreOrHistoryToDoc, inflateLoreOrHistoryDoc } from '../util/documentUtils.js';
import {
	HistoryInfo,
	HistoryMetadata,
	LoreInfo,
	LoreMetadata,
} from '#shared/domain/lore/LoreInterfaces.js';
import {
	historyToMetadata,
	loreToMetadata,
	metadataToHistory,
	metadataToLore,
} from '#shared/util/dbConvertUtils.js';
import { buildLoreId, buildHistoryId } from '../../shared/util/buildIdUtils.js';
import { validateServiceId } from '../util/routeHelpers.js';
import { validateChromaResponse, handleServiceError } from '../util/serviceHelpers.js';

// Destructure chromaDbClient methods
const { getLoreCollection, upsertRecord, getRecords, getRecordById, queryRecords } = chromaDbClient;
const collectionType = COLLECTIONS.LORE;

export const loreStore = {
	// Cache for lore collection
	_loreCollection: null as Collection | null,

	_getCollection: async (): Promise<Collection> => {
		if (loreStore._loreCollection) {
			return loreStore._loreCollection;
		}
		const collection = await getLoreCollection();
		loreStore._loreCollection = collection;
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
			loreInfos: lores,
			loreInfo: lores[0] || null,
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
			historyInfos: histories,
			historyInfo: histories[0] || null,
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
		const collection = await loreStore._getCollection();
		const where: Where = {
			$and: [{ type: { $eq: METADATA_TYPES.LORE } }, { characterId: { $eq: characterId } }],
		};

		try {
			const rawResults = await getRecords(collection, where);
			const results = validateChromaResponse(rawResults, 'getList', collectionType);
			// Build full entities using the unified metadata structure
			return loreStore._constuctLore(results);
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
		const collection = await loreStore._getCollection();

		try {
			const rawResult = await getRecordById(collection, loreId);
			const results = validateChromaResponse(rawResult, 'getOne', collectionType);
			return loreStore._constuctLore(results);
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
		whereFilter?: Where, // CHANGED: Replaced 'options' with specific filter objects
		whereDocument?: WhereDocument,
		limit?: number
	): Promise<LoreResponse> => {
		validateServiceId(characterId, 'lore');
		const collection = await loreStore._getCollection();

		// Build the final where clause by combining mandatory filters with optional, AI-generated ones.
		const baseConditions: Where[] = [
			{ type: { $eq: METADATA_TYPES.LORE } },
			{ characterId: { $eq: characterId } },
		];

		// If an external filter is provided, add it to the conditions.
		const whereClause: Where = whereFilter
			? { $and: [...baseConditions, whereFilter] }
			: { $and: baseConditions };

		try {
			const rawResults = await queryRecords(
				collection,
				queryTexts,
				whereClause,
				whereDocument, // Pass the document filter through
				limit
			);

			// The rest of your result processing logic remains valid.
			const allLores: LoreInfo[] = [];
			const allIds: string[] = [];
			const allDocuments: (string | null)[] = [];
			const allMetadatas: (any | null)[] = [];

			for (const rawResult of rawResults) {
				const results = validateChromaResponse(rawResult, 'getList', 'lore');
				const lores = loreStore._constuctLore(results).loreInfos;

				allLores.push(...lores);
				allIds.push(...results.ids);
				allDocuments.push(...results.documents);
				allMetadatas.push(...results.metadatas);
			}

			// De-duplicate results before returning
			const uniqueLores = Array.from(new Map(allLores.map((l) => [l.loreId, l])).values());

			return {
				ids: allIds,
				documents: allDocuments,
				metadatas: allMetadatas,
				loreInfos: uniqueLores,
				loreContents: uniqueLores.map((lore) => lore.content),
				loreInfo: uniqueLores[0] || null,
				loreContent: uniqueLores[0]?.content || '',
			};
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while querying lores.',
				`Failed to query lores for characterId ${characterId}`
			);
		}
	},
	queryHistories: async (
		characterId: string,
		queryTexts: string[],
		whereFilter?: Where, // CHANGED: Replaced 'options' with specific filter objects
		whereDocument?: WhereDocument,
		limit?: number
	): Promise<HistoryResponse> => {
		validateServiceId(characterId, 'lore');
		const collection = await loreStore._getCollection();

		// Build the final where clause, similar to queryLores.
		const baseConditions: Where[] = [
			{ type: { $eq: METADATA_TYPES.HISTORY } },
			{ characterId: { $eq: characterId } },
		];

		const whereClause: Where = whereFilter
			? { $and: [...baseConditions, whereFilter] }
			: { $and: baseConditions };

		try {
			const rawResults = await queryRecords(
				collection,
				queryTexts,
				whereClause,
				whereDocument, // Pass the document filter through
				limit
			);

			// The rest of your result processing logic remains valid.
			const allHistories: HistoryInfo[] = [];
			const allIds: string[] = [];
			const allDocuments: (string | null)[] = [];
			const allMetadatas: (any | null)[] = [];

			for (const rawResult of rawResults) {
				const results = validateChromaResponse(rawResult, 'getList', 'lore');
				const histories = loreStore._constuctHistory(results).historyInfos;
				allHistories.push(...histories);
				allIds.push(...results.ids);
				allDocuments.push(...results.documents);
				allMetadatas.push(...results.metadatas);
			}

			const uniqueHistories = Array.from(new Map(allHistories.map((h) => [h.historyId, h])).values());

			return {
				ids: allIds,
				documents: allDocuments,
				metadatas: allMetadatas,
				historyInfos: uniqueHistories,
				historyInfo: uniqueHistories[0] || null,
				historyContents: uniqueHistories.map((h) => h.content),
				historyContent: uniqueHistories[0]?.content || '',
			};
		} catch (error) {
			handleServiceError(
				error,
				`An internal error occurred while querying histories.`,
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
			const collection = await loreStore._getCollection();
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
		const collection = await loreStore._getCollection();
		const where: Where = {
			$and: [{ type: { $eq: METADATA_TYPES.HISTORY } }, { characterId: { $eq: characterId } }],
		};

		try {
			const rawResults = await getRecords(collection, where);
			const results = validateChromaResponse(rawResults, 'getList', collectionType);
			const historyInfos = loreStore._constuctHistory(results);
			// Sort by sequence for chronological order
			const sorted = historyInfos.historyInfos.sort((a, b) => a.sequence - b.sequence);

			return {
				...historyInfos,
				historyContents: sorted.map((history) => history.content),
				historyInfo: sorted[0] || null,
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
			const collection = await loreStore._getCollection();
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
		loreStore._loreCollection = null;
	},
};
