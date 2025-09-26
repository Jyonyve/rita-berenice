import { HistoryInfo, HistoryMetadata } from '#shared/domain/history/history.type.js';
import { Collection, Metadata, Where, WhereDocument } from 'chromadb';
import { METADATA_TYPES } from '#shared/config/constants.js';
import { COLLECTIONS } from '../db/ChromaInterfaces.js';
import { chromaDbClient } from '../db/chromaDbClient.js';
import { HistoryResponse, LoreResponse } from '#shared/api/ModuleResponse.js';
import {
	LoreIndexContentType,
	LoreIndexMetadata,
	LoreInfo,
	LoreMetadata,
} from '#shared/domain/lore/lore.type.js';
import { metadataToHistory, metadataToLore } from '#shared/util/dbConvertUtils.js';
import { buildHistoryId, buildLoreId, buildLoreIndexId } from '#shared/util/buildIdUtils.js';
import { validateChromaResponse, handleServiceError } from '../util/serviceHelpers.js';
import { FilterCriteria } from '../util/schemaUtils.js';
import { reRankSemanticResults } from '../util/queryUtils.js';

const {
	getHistoryCollection,
	upsertRecords,
	getRecords,
	getRecordById,
	queryRecords,
	deleteRecords,
} = chromaDbClient;
const collectionType = COLLECTIONS.HISTORY;

const emptyHisRes: HistoryResponse = {
	ids: [],
	metadatas: [],
	documents: [],
	historyInfo: {} as HistoryInfo,
	historyContent: '',
	historyInfos: [],
	historyContents: [],
};

export const historyStore = {
	_historyCollection: null as Collection | null,

	_getCollection: async (): Promise<Collection> => {
		if (historyStore._historyCollection) {
			return historyStore._historyCollection;
		}
		const collection = await getHistoryCollection();
		historyStore._historyCollection = collection;
		return collection;
	},

	/**
	 * @private
	 * Dynamically builds a ChromaDB 'where' clause to filter LORE/HISTORY index documents.
	 */
	_buildIndexWhereClause(characterId: string, criteria: FilterCriteria): Where | undefined {
		const orConditions: Where[] = [];

		const addConditions = (list: string[] | undefined, type: LoreIndexContentType) => {
			if (!list || list.length === 0) return;
			const topTerms = list.slice(0, 5); // Be selective
			topTerms.forEach((item) => {
				orConditions.push({ $and: [{ contentType: { $eq: type } }, { value: { $eq: item } }] });
			});
		};

		addConditions(criteria.topics, 'TOPIC');
		addConditions(criteria.keywords, 'KEYWORD');
		addConditions(criteria.entities?.characters, 'AFFECTED_CHARACTER');
		addConditions(criteria.entities?.locations, 'ENTITY');
		addConditions(criteria.entities?.items, 'ENTITY');
		if (criteria.period) {
			addConditions([criteria.period], 'RELATED_EVENT');
		}

		if (orConditions.length === 0) return undefined;

		return {
			$and: [
				{ type: { $eq: METADATA_TYPES.INDEX } },
				{ characterId: { $eq: characterId } },
				{ $or: orConditions },
			],
		};
	},

	// --- HISTORY OPERATIONS (Corrected and aligned with Lore) ---
	storeHistory: async (historyInfo: HistoryInfo): Promise<{ historyId: string }> => {
		try {
			const collection = await historyStore._getCollection();
			const historyMetadata: HistoryMetadata = {
				type: METADATA_TYPES.HISTORY,
				historyId:
					historyInfo.historyId || buildHistoryId(historyInfo.characterId, historyInfo.periodLabel),
				characterId: historyInfo.characterId,
				userId: historyInfo.userId,
				createdAt: historyInfo.createdAt,
				updatedAt: historyInfo.updatedAt,
				title: historyInfo.title,
				generatedTitle: historyInfo.generatedTitle,
				category: historyInfo.category,
				summary: historyInfo.summary,
				periodLabel: historyInfo.periodLabel,
				eventDateValue: historyInfo.eventDateValue,
				eventDateType: historyInfo.eventDateType,
			};
			await upsertRecords(
				collection,
				[historyInfo.historyId],
				[historyInfo.content],
				[historyMetadata]
			);
			await historyStore._updateSearchIndexForHistory(historyInfo);
			return { historyId: historyInfo.historyId };
		} catch (error) {
			handleServiceError(error, `Failed to store history ${historyInfo.historyId}`);
		}
	},

	_updateSearchIndexForHistory: async (historyInfo: HistoryInfo): Promise<void> => {
		const collection = await historyStore._getCollection();
		const oldIndexWhere: Where = {
			$and: [{ type: { $eq: METADATA_TYPES.INDEX } }, { contentId: { $eq: historyInfo.historyId } }],
		};
		await collection.delete({ where: oldIndexWhere });

		const newIndexRecords: { id: string; document: string; metadata: LoreIndexMetadata }[] = [];
		const baseMetadata = {
			type: METADATA_TYPES.INDEX,
			contentId: historyInfo.historyId,
			characterId: historyInfo.characterId,
		};

		const createIndexRecords = (
			list: any[],
			contentType: LoreIndexContentType,
			contextDescription: string
		) => {
			if (!list || list.length === 0) return;
			for (const item of list) {
				const value = typeof item === 'string' ? item : JSON.stringify(item);
				if (!value || value.trim() === '') continue;
				const semanticDocument = `${contextDescription}: "${value}". From history event titled "${historyInfo.title}", summarized as: ${historyInfo.summary}`;
				newIndexRecords.push({
					id: buildHistoryId(historyInfo.historyId, contentType),
					document: semanticDocument,
					metadata: { ...baseMetadata, contentType, value },
				});
			}
		};

		createIndexRecords(historyInfo.keywordList, 'KEYWORD', 'Key concept');
		createIndexRecords(historyInfo.topicList, 'TOPIC', 'Main topic');
		createIndexRecords(historyInfo.entityList, 'ENTITY', 'Mentioned entity');
		createIndexRecords(
			historyInfo.allAffectedCharacterIdList,
			'AFFECTED_CHARACTER',
			'Affected character'
		);
		createIndexRecords(historyInfo.relatedEventList, 'RELATED_EVENT', 'Related event');

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
	 * Retrieves a single, fully reconstructed Lore object by its ID.
	 * @param historyId The unique identifier for the lore.
	 * @returns A LoreResponse containing the single lore object.
	 */
	async getHistory(historyId: string): Promise<HistoryResponse> {
		try {
			const collection = await historyStore._getCollection();

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

	getHistories: async (characterId: string): Promise<HistoryResponse> => {
		try {
			const collection = await historyStore._getCollection();
			const where: Where = {
				$and: [{ type: { $eq: METADATA_TYPES.HISTORY } }, { characterId: { $eq: characterId } }],
			};
			const historyResults = await getRecords(collection, where);
			const historyPrimaryDocs = validateChromaResponse(historyResults, 'getList', collectionType);
			if (historyPrimaryDocs.ids.length === 0) return emptyHisRes;

			const contentIds = historyPrimaryDocs.ids;
			const indexWhere: Where = {
				$and: [{ type: { $eq: METADATA_TYPES.INDEX } }, { contentId: { $in: contentIds } }],
			};
			const indexResults = await getRecords(collection, indexWhere);
			const allIndexRecords = validateChromaResponse(indexResults, 'getList', collectionType);

			const historyInfos = historyPrimaryDocs.metadatas.map((metadata, i) => {
				const relatedIndexMetadatas = allIndexRecords.metadatas.filter(
					(record) => !!record && record.contentId === (metadata as unknown as HistoryMetadata).historyId
				);
				return metadataToHistory(
					metadata as unknown as HistoryMetadata,
					historyPrimaryDocs.documents[i] || '',
					relatedIndexMetadatas as unknown as LoreIndexMetadata[]
				);
			});

			return {
				ids: historyPrimaryDocs.ids,
				metadatas: historyPrimaryDocs.metadatas,
				documents: historyPrimaryDocs.documents,
				historyInfos,
				historyInfo: historyInfos[0] || null,
				historyContent: historyInfos[0]?.content || '',
				historyContents: historyInfos.map((h) => h.content),
			};
		} catch (error) {
			handleServiceError(error, `Failed to get histories for character ${characterId}`);
		}
	},

	/**
	 * Deletes a history document and all its associated index entries.
	 * @param historyId The unique identifier of the history to delete.
	 */
	deleteHistory: async (historyId: string): Promise<void> => {
		try {
			const collection = await historyStore._getCollection();
			console.log(
				`[LoreStore] Deleting history and all associated indexes for historyId: ${historyId}`
			);

			// This where clause targets both the primary HISTORY document (via its unique `historyId` field)
			// and all its associated INDEX documents (via the `contentId` field).
			const whereFilter: Where = {
				$or: [{ historyId: { $eq: historyId } }, { contentId: { $eq: historyId } }],
			};

			await deleteRecords(collection, undefined, whereFilter);
			console.log(`[LoreStore] Successfully deleted history and indexes for historyId: ${historyId}`);
		} catch (error) {
			handleServiceError(error, `Failed to delete history ${historyId}`);
		}
	},

	/**
	 * [For Backend RAG] Performs a hybrid semantic/metadata search for History entries.
	 */
	async queryHistories(
		characterId: string,
		queryTexts: string[],
		filterCriteria?: FilterCriteria,
		whereDocument?: WhereDocument,
		limit?: number
	): Promise<HistoryResponse> {
		try {
			const collection = await historyStore._getCollection();
			let contentIdsToSearch: string[] | undefined = undefined;

			if (filterCriteria && Object.keys(filterCriteria).length > 0) {
				const indexWhereFilter = historyStore._buildIndexWhereClause(characterId, filterCriteria);
				if (indexWhereFilter) {
					const indexResults = await getRecords(collection, indexWhereFilter);
					const validatedIndexes = validateChromaResponse(indexResults, 'getList', collectionType);
					contentIdsToSearch = [
						...new Set(validatedIndexes.metadatas.map((m) => (m as unknown as LoreIndexMetadata).loreId)),
					];
					if (contentIdsToSearch.length === 0) return emptyHisRes;
				}
			}

			const queryConditions: Where[] = [
				{ type: { $eq: METADATA_TYPES.HISTORY } },
				{ characterId: { $eq: characterId } },
			];
			if (contentIdsToSearch) {
				queryConditions.push({ historyId: { $in: contentIdsToSearch } });
			}
			const queryWhere: Where = { $and: queryConditions };

			const searchLimit = limit ? Math.min(limit * 3, 50) : 30;
			const queryResults = await queryRecords(
				collection,
				queryTexts,
				queryWhere,
				whereDocument,
				searchLimit
			);
			const validatedQueryResults = queryResults.map((r) =>
				validateChromaResponse(r, 'getList', collectionType)
			);

			const rankedResults = reRankSemanticResults(validatedQueryResults, limit, {
				semanticWeight: 1.0,
				recencyWeight: 0.0,
				updatedAtField: 'updatedAt',
			});

			if (rankedResults.ids.length === 0) return emptyHisRes;

			const finalContentIds = rankedResults.ids;
			const allIndexResult = await getRecords(collection, { contentId: { $in: finalContentIds } });
			const validatedIndexes = validateChromaResponse(allIndexResult, 'getList', collectionType);

			const historyInfos = rankedResults.metadatas.map((metadata, i) => {
				const relatedIndexMetadatas = validatedIndexes.metadatas.filter(
					(record): record is Metadata =>
						!!record && record.contentId === (metadata as unknown as HistoryMetadata).historyId
				);
				return metadataToHistory(
					metadata as unknown as HistoryMetadata,
					rankedResults.documents[i] || '',
					relatedIndexMetadatas as unknown as LoreIndexMetadata[]
				);
			});

			return {
				ids: rankedResults.ids,
				metadatas: rankedResults.metadatas,
				documents: rankedResults.documents,
				historyInfos,
				historyInfo: historyInfos[0] || ({} as HistoryInfo),
				historyContent: historyInfos[0]?.content || '',
				historyContents: historyInfos.map((r) => r.content),
			};
		} catch (error) {
			handleServiceError(error, `Failed to query histories for character ${characterId}`);
			return emptyHisRes;
		}
	},

	// --- UTILITY METHODS ---

	/**
	 * Clear collection cache
	 */
	clearCollectionCache: (): void => {
		console.log('[LoreService] Clearing cached lore collection.');
		historyStore._historyCollection = null;
	},
};
