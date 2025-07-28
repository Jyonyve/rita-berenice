// src/server/services/loreStore.ts
import { Collection, Metadata, Where, WhereDocument } from 'chromadb';

import { METADATA_TYPES } from '#shared/config/constants.js';
import { COLLECTIONS } from '../db/ChromaInterfaces.js';
import { chromaDbClient } from '../db/chromaDbClient.js';
import { ChromaResponse, HistoryResponse, LoreResponse } from '#shared/api/ModuleResponse.js';
import { loreOrHistoryToDocument } from '../../shared/util/documentUtils.js';
import {
	HistoryInfo,
	HistoryMetadata,
	LoreIndexContentType,
	LoreIndexMetadata,
	LoreInfo,
	LoreMetadata,
} from '#shared/domain/lore/LoreInterfaces.js';
import {
	historyToMetadata,
	loreToMetadata,
	metadataToHistory,
	metadataToLore,
} from '#shared/util/dbConvertUtils.js';
import { buildLoreId, buildHistoryId, buildLoreIndexId } from '#shared/util/buildIdUtils.js';
import { validateServiceId } from '../util/routeHelpers.js';
import { validateChromaResponse, handleServiceError } from '../util/serviceHelpers.js';

// Destructure chromaDbClient methods
const {
	getLoreCollection,
	upsertRecord,
	upsertRecords,
	getRecords,
	getRecordById,
	queryRecords,
	deleteRecordById,
} = chromaDbClient;
const collectionType = COLLECTIONS.LORE;

const emptyLoreRes = {
	ids: [],
	metadatas: [],
	documents: [],
	loreInfo: {} as LoreInfo,
	loreContent: '',
	loreInfos: [],
	loreContents: [],
};
const emptyHisRes = {
	ids: [],
	metadatas: [],
	documents: [],
	historyInfo: {} as HistoryInfo,
	historyContent: '',
	historyInfos: [],
	historyContents: [],
};

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
	/**
	 * @private
	 * Creates or updates the denormalized search index records for Lore or History.
	 */
	async _updateSearchIndexForContent(contentInfo: LoreInfo | HistoryInfo): Promise<void> {
		const collection = await loreStore._getCollection();
		const isLore = contentInfo.type === METADATA_TYPES.LORE;
		const contentId = isLore
			? (contentInfo as LoreInfo).loreId
			: (contentInfo as HistoryInfo).historyId;

		// 1. Atomically delete all existing index entries for loreStore content.
		await deleteRecordById(collection, contentId);

		const newIndexRecords: { id: string; metadata: LoreIndexMetadata; document: string }[] = [];
		const baseMetadata = {
			type: METADATA_TYPES.INDEX,
			contentId: contentId,
			characterId: contentInfo.characterId,
		};

		const createIndexRecords = (list: string[], contentType: LoreIndexContentType) => {
			for (const value of list) {
				newIndexRecords.push({
					id: buildLoreIndexId(contentId, contentType),
					metadata: { ...baseMetadata, contentType, value },
					document: value,
				});
			}
		};

		// 2. Create new index records for all filterable attributes.
		createIndexRecords(contentInfo.allAffectedCharacterIdList, 'AFFECTED_CHARACTER');
		createIndexRecords(contentInfo.keywordList, 'KEYWORD');
		if (isLore) {
			createIndexRecords((contentInfo as LoreInfo).topicList, 'TOPIC');
		} else {
			const relatedEventValues = (contentInfo as HistoryInfo).relatedEventList.map((e) =>
				JSON.stringify(e)
			);
			createIndexRecords(relatedEventValues, 'RELATED_EVENT');
		}

		// 3. Batch upsert the new index records.
		if (newIndexRecords.length > 0) {
			await upsertRecords(
				collection,
				newIndexRecords.map((r) => r.id),
				newIndexRecords.map((r) => r.document),
				newIndexRecords.map((r) => r.metadata)
			);
		}
	},

	/**
	 * @private
	 * Reconstructs rich LoreInfo objects from primary documents and their index records.
	 */
	_constructFullLores(
		loreMetadatas: LoreMetadata[],
		allIndexRecords: LoreIndexMetadata[]
	): LoreInfo[] {
		return loreMetadatas.map((metadata) => {
			const relatedIndexRecords = allIndexRecords.filter(
				(record) => record.contentId === metadata.loreId
			);
			// The document/content is not stored in the metadata, so it must be passed separately
			// In a real query, you'd fetch documents alongside metadata
			const content = ''; // Placeholder, actual content would be retrieved from the document field
			return metadataToLore(metadata, content, relatedIndexRecords);
		});
	},

	/**
	 * @private
	 * Reconstructs rich HistoryInfo objects from primary documents and their index records.
	 */
	_constructFullHistories(
		historyMetadatas: HistoryMetadata[],
		allIndexRecords: LoreIndexMetadata[]
	): HistoryInfo[] {
		return historyMetadatas.map((metadata) => {
			const relatedIndexRecords = allIndexRecords.filter(
				(record) => record.contentId === metadata.historyId
			);
			const content = ''; // Placeholder
			return metadataToHistory(metadata, content, relatedIndexRecords);
		});
	},

	// --- LORE OPERATIONS ---

	async storeLore(loreInfo: LoreInfo): Promise<void> {
		try {
			const collection = await loreStore._getCollection();
			const metadata = loreToMetadata(loreInfo);
			const document = loreOrHistoryToDocument(loreInfo);

			await upsertRecord(collection, metadata.loreId, document, metadata);
			await loreStore._updateSearchIndexForContent(loreInfo);
		} catch (error) {
			handleServiceError(error, `Failed to store lore ${loreInfo.loreId}`);
		}
	},

	async getLores(characterId: string): Promise<LoreResponse> {
		try {
			const collection = await loreStore._getCollection();
			const where: Where = {
				$and: [{ type: { $eq: METADATA_TYPES.LORE } }, { characterId: { $eq: characterId } }],
			};

			// 1. Fetch all primary LORE documents for the character
			const loreResults = await getRecords(collection, where);
			const loreResult = validateChromaResponse(loreResults, 'getList', collectionType);

			if (loreResult.metadatas.length === 0) {
				return emptyLoreRes;
			}
			const loreIds = loreResult.ids.filter((m): m is string => !!m);
			const loreMetadatas = loreResult.metadatas.filter((m): m is Metadata => !!m);
			const loreDocuments = loreResult.documents.filter((m): m is string => !!m);

			// 2. Fetch all associated search index records
			const contentIds: string[] = loreResult.metadatas
				.map((m) => (m || {}).loreId)
				.filter((id): id is string => typeof id === 'string');
			const indexResults = await getRecords(collection, { contentId: { $in: contentIds } });
			const allIndexResult = validateChromaResponse(indexResults, 'getList', collectionType);

			// 3. Reconstruct the full rich objects
			const loreInfos = loreMetadatas.map((metadata, i) => {
				const relatedIndexMetadatas = allIndexResult.metadatas.filter(
					(record): record is Metadata => !!record && record.contentId === metadata.loreId
				);
				return metadataToLore(
					metadata as unknown as LoreMetadata,
					loreResult.documents[i] || '',
					relatedIndexMetadatas as unknown as LoreIndexMetadata[]
				);
			});

			return {
				ids: loreIds,
				metadatas: loreMetadatas,
				documents: loreDocuments,
				loreInfos,
				loreInfo: loreInfos[0] || null,
				loreContent: loreInfos[0].content || '',
				loreContents: loreInfos.map((l) => l.content),
			};
		} catch (error) {
			handleServiceError(error, `Failed to get lores for character ${characterId}`);
		}
	},

	/**
	 * Retrieves a single, fully reconstructed Lore object by its ID.
	 * @param loreId The unique identifier for the lore.
	 * @returns A LoreResponse containing the single lore object.
	 */
	async getLore(loreId: string): Promise<LoreResponse> {
		try {
			const collection = await loreStore._getCollection();

			// 1. Fetch the primary LORE document by its unique ID.
			const rawLoreResult = await getRecordById(collection, loreId);
			const primaryLoreResult = validateChromaResponse(rawLoreResult, 'getOne', collectionType);

			// If no document is found, return the empty response immediately.
			if (primaryLoreResult.ids.length === 0) {
				console.warn(`[getLore] No lore document found with ID: ${loreId}`);
				return emptyLoreRes;
			}

			const loreMetadata = primaryLoreResult.metadatas?.[0] || {};
			const loreDocument = primaryLoreResult.documents[0] || '';

			// 2. Fetch all associated LORE_INDEX records for this specific loreId.
			const indexWhereClause: Where = {
				$and: [
					{ type: { $eq: METADATA_TYPES.LORE } },
					{ contentId: { $eq: loreId } }, // Direct match, more efficient than $in
				],
			};
			const rawIndexResults = await getRecords(collection, indexWhereClause);
			const indexResults = validateChromaResponse(rawIndexResults, 'getList', collectionType);
			const indexMetadatas = (indexResults.metadatas || []) as unknown as LoreIndexMetadata[];

			// 3. Reconstruct the single, rich Lore object.
			const loreInfo: LoreInfo = metadataToLore(
				loreMetadata as unknown as LoreMetadata,
				loreDocument,
				indexMetadatas
			);

			// 4. Return the response object populated with the single lore.
			return {
				ids: [loreInfo.loreId],
				metadatas: [loreMetadata],
				documents: [loreDocument], // Or include index documents if needed
				loreInfos: [loreInfo],
				loreInfo: loreInfo,
				loreContent: loreInfo.content,
				loreContents: [loreInfo.content],
			};
		} catch (error) {
			// Handle other potential errors.
			handleServiceError(
				error,
				'An internal error occurred in [getLore].',
				`Failed to get lore for ID ${loreId}`,
				{ suppress404: true }
			);
		}
	},

	// --- HISTORY OPERATIONS ---

	async storeHistory(historyInfo: HistoryInfo): Promise<void> {
		try {
			const collection = await loreStore._getCollection();
			const metadata = historyToMetadata(historyInfo);
			const document = loreOrHistoryToDocument(historyInfo);

			await upsertRecord(collection, metadata.historyId, document, metadata);
			await loreStore._updateSearchIndexForContent(historyInfo);
		} catch (error) {
			handleServiceError(error, `Failed to store history ${historyInfo.historyId}`);
		}
	},

	async getHistories(characterId: string): Promise<HistoryResponse> {
		try {
			const collection = await loreStore._getCollection();
			const where: Where = {
				$and: [{ type: { $eq: METADATA_TYPES.HISTORY } }, { characterId: { $eq: characterId } }],
			};

			// 1. Fetch primary HISTORY documents
			const historyResults = await getRecords(collection, where);

			const historyResult = validateChromaResponse(historyResults, 'getList', collectionType);

			if (historyResult.metadatas.length === 0) {
				return emptyHisRes;
			}

			// Safely extract valid metadata entries
			const historyIds = historyResult.ids.filter((m): m is string => !!m);
			const historyMetadatas = historyResult.metadatas.filter((m): m is Metadata => !!m);
			const historyDocuments = historyResult.documents.filter((m): m is string => !!m);

			// 2. Fetch associated index records using filtered content IDs
			const contentIds: string[] = historyMetadatas
				.map((m) => m.historyId)
				.filter((id): id is string => typeof id === 'string');

			const indexResults = await getRecords(collection, { contentId: { $in: contentIds } });

			const allIndexResult = validateChromaResponse(indexResults, 'getList', collectionType);

			// 3. Reconstruct full history infos
			const historyInfos = historyMetadatas.map((metadata, i) => {
				const relatedIndexRecords = allIndexResult.metadatas.filter(
					(record): record is Metadata => !!record && record.contentId === metadata.historyId
				);
				return metadataToHistory(
					metadata as unknown as HistoryMetadata,
					historyResult.documents[i] || '',
					relatedIndexRecords as unknown as LoreIndexMetadata[]
				);
			});

			return {
				ids: historyIds,
				metadatas: historyMetadatas,
				documents: historyDocuments,
				historyInfos,
				historyInfo: historyInfos[0] || null,
				historyContent: historyInfos[0].content || '',
				historyContents: historyInfos.map((l) => l.content),
			};
		} catch (error) {
			handleServiceError(error, `Failed to get histories for character ${characterId}`);
		}
	},
	/**
	 * Retrieves a single, fully reconstructed Lore object by its ID.
	 * @param historyId The unique identifier for the lore.
	 * @returns A LoreResponse containing the single lore object.
	 */
	async getHistory(historyId: string): Promise<HistoryResponse> {
		try {
			const collection = await loreStore._getCollection();

			// 1. Fetch the primary LORE document by its unique ID.
			const rawHisResult = await getRecordById(collection, historyId);
			const primaryHisResult = validateChromaResponse(rawHisResult, 'getOne', collectionType);

			// If no document is found, return the empty response immediately.
			if (primaryHisResult.ids.length === 0) {
				console.warn(`[getLore] No lore document found with ID: ${historyId}`);
				return emptyHisRes;
			}

			const hisMetadata = primaryHisResult.metadatas?.[0] || {};
			const hisDocument = primaryHisResult.documents[0] || '';

			// 2. Fetch all associated LORE_INDEX records for this specific loreId.
			const indexWhereClause: Where = {
				$and: [
					{ type: { $eq: METADATA_TYPES.HISTORY } },
					{ contentId: { $eq: historyId } }, // Direct match, more efficient than $in
				],
			};
			const rawIndexResults = await getRecords(collection, indexWhereClause);
			const indexResults = validateChromaResponse(rawIndexResults, 'getList', collectionType);
			const indexMetadatas = (indexResults.metadatas || []) as unknown as LoreIndexMetadata[];

			// 3. Reconstruct the single, rich Lore object.
			const historyInfo: HistoryInfo = metadataToHistory(
				hisMetadata as unknown as HistoryMetadata,
				hisDocument,
				indexMetadatas
			);

			// 4. Return the response object populated with the single lore.
			return {
				ids: [historyInfo.historyId],
				metadatas: [hisMetadata],
				documents: [hisDocument], // Or include index documents if needed
				historyInfos: [historyInfo],
				historyInfo: historyInfo,
				historyContent: historyInfo.content,
				historyContents: [historyInfo.content],
			};
		} catch (error) {
			// Handle other potential errors.
			handleServiceError(
				error,
				'An internal error occurred in [getLore].',
				`Failed to get lore for ID ${historyId}`,
				{ suppress404: true }
			);
		}
	},

	// --- QUERY OPERATIONS ---

	/**
	 * [For Backend RAG] Performs a hybrid semantic/metadata search for Lore entries.
	 */
	async queryLores(
		characterId: string, // Primary character context
		queryTexts: string[],
		whereFilter?: Where, // This filter is for the INDEX records
		whereDocument?: WhereDocument,
		limit?: number
	): Promise<LoreInfo[]> {
		try {
			const collection = await loreStore._getCollection();
			let contentIdsToSearch: string[] | undefined = undefined;

			// Step 1: Pre-filter using the index to get relevant lore IDs.
			if (whereFilter && Object.keys(whereFilter).length > 0) {
				const indexResults = await getRecords(collection, whereFilter);
				const validatedIndexes = validateChromaResponse(indexResults, 'getList', collectionType);
				contentIdsToSearch = [
					...new Set(validatedIndexes.metadatas.map((m) => (m as unknown as LoreMetadata).loreId)),
				];

				if (contentIdsToSearch.length === 0) {
					return [];
				}
			}

			// Step 2: Perform semantic search on the pre-filtered set of primary documents.
			const queryConditions: Where[] = [
				{ type: { $eq: METADATA_TYPES.LORE } },
				{ characterId: { $eq: characterId } },
			];
			if (contentIdsToSearch) {
				queryConditions.push({ loreId: { $in: contentIdsToSearch } });
			}
			const queryWhere: Where = { $and: queryConditions };

			const queryResults = await queryRecords(
				collection,
				queryTexts,
				queryWhere,
				whereDocument,
				limit
			);
			const validatedQueryResults = queryResults.map((r) =>
				validateChromaResponse(r, 'getList', collectionType)
			);
			const loreMetadatas = validatedQueryResults.flatMap((r) => r.metadatas);
			const loreDocuments = validatedQueryResults.flatMap((r) => r.documents);

			if (loreMetadatas.length === 0) {
				return [];
			}

			// Step 3: Fetch all index records for the final set of lores to enable full reconstruction.
			const finalContentIds = loreMetadatas
				.map((m) => m?.loreId)
				.filter((id): id is string => typeof id === 'string');
			const finalIndexResults = await getRecords(collection, { loreId: { $in: finalContentIds } });
			const allIndexResult = validateChromaResponse(finalIndexResults, 'getList', collectionType);

			// Step 4: Reconstruct the full rich objects.
			return loreMetadatas.map((metadata, i) => {
				const relatedIndexMetadatas = allIndexResult.metadatas.filter(
					(record): record is Metadata => !!record && record.contentId === metadata?.loreId
				);
				return metadataToLore(
					metadata as unknown as LoreMetadata,
					loreDocuments[i] || '',
					relatedIndexMetadatas as unknown as LoreIndexMetadata[]
				);
			});
		} catch (error) {
			handleServiceError(error, `Failed to query lores for character ${characterId}`);
		}
	},

	/**
	 * [For Backend RAG] Performs a hybrid semantic/metadata search for History entries.
	 */
	async queryHistories(
		characterId: string, // Primary character context
		queryTexts: string[],
		whereFilter?: Where, // This filter is for the INDEX records
		whereDocument?: WhereDocument,
		limit?: number
	): Promise<HistoryInfo[]> {
		try {
			const collection = await loreStore._getCollection();
			let contentIdsToSearch: string[] | undefined = undefined;

			// Step 1: Pre-filter using the index to get relevant history IDs.
			if (whereFilter && Object.keys(whereFilter).length > 0) {
				const indexResults = await getRecords(collection, whereFilter);
				const validatedIndexes = validateChromaResponse(indexResults, 'getList', collectionType);
				contentIdsToSearch = [
					...new Set(
						validatedIndexes.metadatas.map((m) => (m as unknown as LoreIndexMetadata).contentId)
					),
				];

				if (contentIdsToSearch.length === 0) {
					return [];
				}
			}

			// Step 2: Perform semantic search on the pre-filtered set of primary documents.
			const queryConditions: Where[] = [
				{ type: { $eq: METADATA_TYPES.HISTORY } },
				{ characterId: { $eq: characterId } },
			];
			if (contentIdsToSearch) {
				queryConditions.push({ historyId: { $in: contentIdsToSearch } });
			}
			const queryWhere: Where = { $and: queryConditions };

			const queryResults = await queryRecords(
				collection,
				queryTexts,
				queryWhere,
				whereDocument,
				limit
			);
			const validatedQueryResults = queryResults.map((r) =>
				validateChromaResponse(r, 'getList', collectionType)
			);
			const historyMetadatas = validatedQueryResults.flatMap((r) => r.metadatas);
			const historyDocuments = validatedQueryResults.flatMap((r) => r.documents);

			if (historyMetadatas.length === 0) {
				return [];
			}

			// Step 3: Fetch all index records for the final set of histories.
			const finalContentIds = historyMetadatas
				.map((m) => m?.historyId)
				.filter((id): id is string => typeof id === 'string');
			const finalIndexResults = await getRecords(collection, { contentId: { $in: finalContentIds } });
			const allIndexResult = validateChromaResponse(finalIndexResults, 'getList', collectionType);

			// Step 4: Reconstruct the full rich objects.
			return historyMetadatas.map((metadata, i) => {
				const relatedIndexRecords = allIndexResult.metadatas.filter(
					(record): record is Metadata => !!record && record.contentId === metadata?.historyId
				);
				return metadataToHistory(
					metadata as unknown as HistoryMetadata,
					historyDocuments[i] || '',
					relatedIndexRecords as unknown as LoreIndexMetadata[]
				);
			});
		} catch (error) {
			handleServiceError(error, `Failed to query histories for character ${characterId}`);
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
