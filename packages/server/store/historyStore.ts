import { Collection, Metadata, Where, WhereDocument } from 'chromadb';
import { METADATA_TYPES } from '@rita-berenice/shared/config/constants.js';
import { COLLECTIONS } from '../db/ChromaInterfaces.js';
import { chromaDbClient } from '../db/chromaDbClient.js';
import {
	HistoryIndexContentType,
	HistoryIndexMetadata,
	HistoryInfo,
	HistoryMetadata,
} from '@rita-berenice/shared/domain/history/history.type.js';
import { validateChromaResponse, handleServiceError } from '../util/serviceHelpers.js';
import { FilterCriteria } from '../util/schemaUtils.js';
import { reRankSemanticResults } from '../util/queryUtils.js';
import { HistoryResponse } from '@rita-berenice/shared/api/ModuleResponse.js';
import { historyToMetadata, metadataToHistory } from '@rita-berenice/shared/util/dbConvertUtils.js';
import { historyToDocument } from '../util/documentUtils.js';
import { buildHistoryIndexId } from '@rita-berenice/shared/util/buildIdUtils.js';

const {
	getHistoryCollection,
	upsertRecords,
	getRecords,
	upsertRecord,
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

		const addConditions = (list: string[] | undefined, type: HistoryIndexContentType) => {
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

	/**
	 * @private
	 * Creates or updates semantic-rich search index records for a given HistoryInfo.
	 * Follows the chatStore._updateSearchIndexForTurn pattern.
	 */
	_updateSearchIndexForHistory: async (historyInfo: HistoryInfo): Promise<void> => {
		const collection = await historyStore._getCollection();

		// 1. Delete existing index entries for this historyId
		const oldIndexWhere: Where = {
			$and: [{ type: { $eq: METADATA_TYPES.INDEX } }, { historyId: { $eq: historyInfo.historyId } }],
		};
		await collection.delete({ where: oldIndexWhere });

		// 2. Prepare to create new index records
		const newIndexRecords: { id: string; document: string; metadata: HistoryIndexMetadata }[] = [];
		const baseMetadata: Omit<HistoryIndexMetadata, 'contentType' | 'value'> = {
			type: METADATA_TYPES.INDEX,
			historyId: historyInfo.historyId,
			characterId: historyInfo.characterId,
			userId: historyInfo.userId,
			category: historyInfo.category,
			originalCreatedAt: historyInfo.createdAt,
		};

		const historyContext = `History event titled "${historyInfo.title}", category: ${historyInfo.category}. Summary: ${historyInfo.summary}`;

		const createIndexRecords = (
			list: any[],
			contentType: HistoryIndexContentType,
			contextDescription: string
		) => {
			if (!list || list.length === 0) return;

			for (const item of list) {
				const value = typeof item === 'string' ? item : JSON.stringify(item);
				if (!value || value.trim() === '') continue;

				const semanticDocument = `${contextDescription}: "${value}". ${historyContext}`;
				newIndexRecords.push({
					id: buildHistoryIndexId(historyInfo.historyId, contentType), // Unique ID per value
					document: semanticDocument,
					metadata: { ...baseMetadata, contentType, value },
				});
			}
		};

		// 3. Generate index records for all searchable arrays
		createIndexRecords(
			historyInfo.allAffectedCharacterIdList,
			'AFFECTED_CHARACTER',
			'Affected character'
		);
		createIndexRecords(historyInfo.keywordList, 'KEYWORD', 'Key concept');
		createIndexRecords(historyInfo.topicList, 'TOPIC', 'Main topic');
		createIndexRecords(historyInfo.entityList, 'ENTITY', 'Mentioned entity');
		createIndexRecords(historyInfo.relatedEventList, 'RELATED_EVENT', 'Related event');

		// 4. Batch upsert the new index records
		if (newIndexRecords.length > 0) {
			await upsertRecords(
				collection,
				newIndexRecords.map((r) => r.id),
				newIndexRecords.map((r) => r.document),
				newIndexRecords.map((r) => r.metadata)
			);
		}
	},
	// --- HISTORY OPERATIONS ---
	/**
	 * Stores a fully enriched history event and updates its search index.
	 * The historyInfo object should already have its historyId assigned.
	 */
	storeHistory: async (historyInfo: HistoryInfo): Promise<{ historyId: string }> => {
		try {
			const collection = await historyStore._getCollection();
			const historyMetadata = historyToMetadata(historyInfo);
			const document = historyToDocument(historyInfo); // Pass the info object

			// 1. Store the primary HISTORY document
			await upsertRecord(collection, historyInfo.historyId, document, historyMetadata);

			// 2. Update the denormalized search index
			await historyStore._updateSearchIndexForHistory(historyInfo);

			return { historyId: historyInfo.historyId };
		} catch (error) {
			handleServiceError(error, `Failed to store history ${historyInfo.historyId}`);
		}
	},

	/**
	 * Retrieves a single, fully reconstructed History object by its ID.
	 */
	getHistory: async (historyId: string): Promise<HistoryResponse> => {
		try {
			const collection = await historyStore._getCollection();

			// 1. Fetch the primary history document and all its index records in one go.
			const historyAndIndexDocsResponse = await getRecords(collection, {
				historyId: { $eq: historyId },
			});
			const allDocs = validateChromaResponse(historyAndIndexDocsResponse, 'getList', collectionType);

			if (allDocs.ids.length === 0) {
				return emptyHisRes;
			}

			// 2. Partition the results into the primary doc and its index records.
			let primaryDoc: { id: string; document: string | null; metadata: Metadata | null } | null = null;
			const indexRecords: Metadata[] = [];

			for (let i = 0; i < allDocs.metadatas.length; i++) {
				const metadata = allDocs.metadatas[i];
				if (metadata?.type === METADATA_TYPES.HISTORY) {
					primaryDoc = { id: allDocs.ids[i], document: allDocs.documents[i], metadata };
				} else if (metadata?.type === METADATA_TYPES.INDEX) {
					indexRecords.push(metadata);
				}
			}

			if (!primaryDoc) return emptyHisRes;

			// 3. Reconstruct the rich object.
			const historyInfo = metadataToHistory(
				primaryDoc.metadata as unknown as HistoryMetadata,
				primaryDoc.document || '',
				indexRecords as unknown as HistoryIndexMetadata[]
			);

			// 4. Return the response.
			return {
				ids: [primaryDoc.id],
				metadatas: [primaryDoc.metadata],
				documents: [primaryDoc.document],
				historyInfos: [historyInfo],
				historyInfo,
				historyContent: historyInfo.content,
				historyContents: [historyInfo.content],
			};
		} catch (error) {
			handleServiceError(error, `Failed to get history for ID ${historyId}`);
		}
	},

	/**
	 * Retrieves all history events for a specific character.
	 */
	getHistories: async (characterId: string): Promise<HistoryResponse> => {
		try {
			const collection = await historyStore._getCollection();

			// 1. Fetch all primary HISTORY documents for the character.
			const where: Where = {
				$and: [{ type: { $eq: METADATA_TYPES.HISTORY } }, { characterId: { $eq: characterId } }],
			};
			const historyResults = await getRecords(collection, where);
			const primaryDocs = validateChromaResponse(historyResults, 'getList', collectionType);
			if (primaryDocs.ids.length === 0) return emptyHisRes;

			// 2. Fetch all index records for these histories in one call.
			const historyIds = primaryDocs.ids;
			const indexWhere: Where = {
				$and: [{ type: { $eq: METADATA_TYPES.INDEX } }, { historyId: { $in: historyIds } }],
			};
			const indexResults = await getRecords(collection, indexWhere);
			const allIndexRecords = validateChromaResponse(
				indexResults,
				'getList',
				collectionType
			).metadatas;

			// 3. Reconstruct full rich objects.
			const historyInfos = primaryDocs.metadatas.map((metadata, i) => {
				const relatedIndexes = (allIndexRecords as unknown as HistoryIndexMetadata[]).filter(
					(record) => record.historyId === (metadata as unknown as HistoryMetadata).historyId
				);
				return metadataToHistory(
					metadata as unknown as HistoryMetadata,
					primaryDocs.documents[i] || '',
					relatedIndexes
				);
			});

			return {
				ids: primaryDocs.ids,
				metadatas: primaryDocs.metadatas,
				documents: primaryDocs.documents,
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
	 */
	deleteHistory: async (historyId: string): Promise<void> => {
		try {
			const collection = await historyStore._getCollection();

			// Delete primary document AND all index records using the historyId field
			const whereFilter: Where = { historyId: { $eq: historyId } };

			await deleteRecords(collection, undefined, whereFilter);
		} catch (error) {
			handleServiceError(error, `Failed to delete history ${historyId}`);
		}
	},

	/**
	 * [For Backend RAG] Performs a hybrid semantic/metadata search for History entries.
	 */
	queryHistories: async (
		characterId: string,
		queryTexts: string[],
		filterCriteria?: FilterCriteria,
		whereDocument?: WhereDocument,
		limit?: number
	): Promise<HistoryResponse> => {
		try {
			const collection = await historyStore._getCollection();
			let historyIdsToSearch: string[] | undefined = undefined;

			// 1. Pre-filter via INDEX documents to get candidate historyIds.
			if (filterCriteria && Object.keys(filterCriteria).length > 0) {
				const indexWhereFilter = historyStore._buildIndexWhereClause(characterId, filterCriteria);
				if (indexWhereFilter) {
					const indexResults = await getRecords(collection, indexWhereFilter);
					const validatedIndexes = validateChromaResponse(indexResults, 'getList', collectionType);
					historyIdsToSearch = [
						...new Set(
							validatedIndexes.metadatas.map((m) => (m as unknown as HistoryIndexMetadata).historyId)
						),
					];
					if (historyIdsToSearch.length === 0) return emptyHisRes;
				}
			}

			// 2. Build the main query for primary HISTORY documents.
			const queryConditions: Where[] = [
				{ type: { $eq: METADATA_TYPES.HISTORY } },
				{ characterId: { $eq: characterId } },
			];
			if (historyIdsToSearch) {
				queryConditions.push({ historyId: { $in: historyIdsToSearch } });
			}
			const queryWhere: Where = { $and: queryConditions };

			// 3. Perform the hybrid search.
			const searchLimit = limit ? Math.min(limit * 3, 50) : 30;
			const queryResults = await queryRecords(
				collection,
				queryTexts,
				queryWhere,
				whereDocument,
				searchLimit
			);
			const validatedResults = queryResults.map((r) =>
				validateChromaResponse(r, 'getList', collectionType)
			);

			// 4. Rank results.
			const rankedResults = reRankSemanticResults(validatedResults, limit, {
				semanticWeight: 1.0,
				recencyWeight: 0.0,
				updatedAtField: 'updatedAt',
			});
			if (rankedResults.ids.length === 0) return emptyHisRes;

			// 5. Reconstruct full objects.
			const finalHistoryIds = rankedResults.ids;
			const allIndexResult = await getRecords(collection, { historyId: { $in: finalHistoryIds } });
			const allIndexRecords = validateChromaResponse(
				allIndexResult,
				'getList',
				collectionType
			).metadatas;

			const historyInfos = rankedResults.metadatas.map((metadata, i) => {
				const relatedIndexes = (allIndexRecords as unknown as HistoryIndexMetadata[]).filter(
					(record) => record.historyId === (metadata as unknown as HistoryMetadata).historyId
				);
				return metadataToHistory(
					metadata as unknown as HistoryMetadata,
					rankedResults.documents[i] || '',
					relatedIndexes
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
		}
	},

	clearCollectionCache: (): void => {
		historyStore._historyCollection = null;
	},
};
