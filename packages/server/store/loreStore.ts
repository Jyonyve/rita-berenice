// src/server/services/loreStore.ts

import { LoreResponse, Metadata } from '@rita-berenice/shared/api';
import { METADATA_TYPES } from '@rita-berenice/shared/config';
import {
	LoreInfo,
	LoreMetadata,
	LoreIndexMetadata,
	LoreIndexContentType,
} from '@rita-berenice/shared/domain';
import { metadataToLore, buildLoreIndexId, loreToMetadata } from '@rita-berenice/shared/util';
import { Collection, Where, WhereDocument } from 'chromadb';
import { COLLECTIONS, toChromaMetadata } from '../db/chroma.type.js';
import chromaDbClient from '../db/chromaDbClient.js';
import { loreToDocument } from '../util/documentUtils.js';
import { reRankSemanticResults } from '../util/queryUtils.js';
import { FilterCriteria } from '../util/schemaUtils.js';
import { validateChromaResponse, handleServiceError } from '../util/serviceHelpers.js';

// Destructure chromaDbClient methods
const { getLoreCollection, upsertRecord, getRecords, queryRecords, deleteRecords } = chromaDbClient;
const collectionType = COLLECTIONS.LORE;

const emptyLoreRes: LoreResponse = {
	ids: [],
	metadatas: [],
	documents: [],
	loreInfo: {} as LoreInfo,
	loreContent: '',
	loreInfos: [],
	loreContents: [],
};

export const loreStore = {
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
	 * Reconstructs rich LoreInfo objects from primary documents and their associated index records.
	 * Following your chatStore pattern exactly.
	 */
	_constructLoreIndexes: async (loreIds: string[]): Promise<Metadata[]> => {
		const collection = await loreStore._getCollection();
		const rawIndexResults = await getRecords(collection, { loreId: { $in: loreIds } });
		const indexResults = validateChromaResponse(rawIndexResults, 'getList', collectionType);
		return indexResults.metadatas.filter((m) => !!m);
	},

	/**
	 * @private
	 * Reconstructs rich LoreInfo objects from primary documents and their associated index records.
	 * Following your chatStore _constructFullChatTurns pattern exactly.
	 */
	_constructFullLores(
		loreMetadatas: (Metadata | null)[],
		allIndexRecords: (Metadata | null)[]
	): LoreInfo[] {
		return (loreMetadatas as unknown as LoreMetadata[]).map((metadata) => {
			// Find all index records that belong to this specific lore
			const relatedIndexRecords = (allIndexRecords as unknown as LoreIndexMetadata[]).filter(
				(record) => record.loreId === metadata.loreId
			);
			// Use the utility to "inflate" the rich object
			return metadataToLore(metadata, '', relatedIndexRecords);
		});
	},

	/**
	 * @private
	 * Creates or updates semantic-rich search index records for a given LoreInfo.
	 * Following your chatStore _updateSearchIndexForTurn pattern exactly.
	 */
	_updateSearchIndexForLore: async (loreInfo: LoreInfo): Promise<void> => {
		const collection = await loreStore._getCollection();

		// Delete existing index entries
		const oldIndexWhere: Where = {
			$and: [{ type: { $eq: METADATA_TYPES.INDEX } }, { loreId: { $eq: loreInfo.loreId } }],
		};
		await collection.delete({ where: oldIndexWhere });

		const newIndexRecords: { id: string; document: string; metadata: LoreIndexMetadata }[] = [];
		const baseMetadata = {
			type: METADATA_TYPES.INDEX,
			loreId: loreInfo.loreId,
			userId: loreInfo.userId,
			category: loreInfo.category,
			originalCreatedAt: loreInfo.createdAt,
		};

		// Enhanced context for richer semantic understanding
		const loreContext = `Lore titled "${loreInfo.title}", category: ${loreInfo.category}. Summary: ${loreInfo.summary}. Content: ${loreInfo.content.slice(0, 200)}...`;

		// Create semantic-searchable documents for different content types
		const createIndexRecords = (
			list: string[],
			contentType: LoreIndexContentType,
			contextDescription: string
		) => {
			if (!list || list.length === 0) return;

			list.forEach((value) => {
				if (!value || value.trim() === '') return;

				// Create rich document content for semantic search
				const semanticDocument = `${contextDescription}: "${value}". ${loreContext}`;

				newIndexRecords.push({
					id: buildLoreIndexId(loreInfo.loreId, contentType),
					document: semanticDocument,
					metadata: { ...baseMetadata, contentType, value: value.trim() },
				});
			});
		};

		// Create semantic index records with rich context
		createIndexRecords(
			loreInfo.characterIds,
			'AFFECTED_CHARACTER',
			'Character associated with this lore'
		);
		createIndexRecords(loreInfo.keywordList, 'KEYWORD', 'Key concept or important term in this lore');
		createIndexRecords(loreInfo.topicList, 'TOPIC', 'Main topic or theme of this lore');
		createIndexRecords(
			loreInfo.entityList,
			'ENTITY',
			'Person, place, or thing mentioned in this lore'
		);

		// Batch upsert the enriched index records
		if (newIndexRecords.length > 0) {
			await chromaDbClient.upsertRecords(
				collection,
				newIndexRecords.map((r) => r.id),
				newIndexRecords.map((r) => r.document),
				newIndexRecords.map((r) => toChromaMetadata(r.metadata))
			);
		}
	},

	/**
	 * @private
	 * Builds ChromaDB 'where' clause to filter lore index documents by search criteria
	 */
	_buildIndexWhereClause(characterIds: string[], criteria: FilterCriteria): Where | undefined {
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
				{
					$or: [
						{ value: { $in: characterIds } }, // Match any character in the list
						{ $or: orConditions },
					],
				},
			],
		};
	},

	// --- LORE OPERATIONS ---
	storeLore: async (loreInfo: LoreInfo): Promise<{ loreId: string }> => {
		try {
			const collection = await loreStore._getCollection();

			// 1. Convert rich LoreInfo to lean metadata (following new structure)
			const loreMetadata = loreToMetadata(loreInfo);

			// 2. Create document for semantic search
			const document = loreToDocument(loreInfo);
			const chromaMetadata = toChromaMetadata(loreMetadata);
			// 3. Store primary document (lean metadata + semantic document)
			await upsertRecord(collection, loreInfo.loreId, document, chromaMetadata);

			// 4. Update the denormalized search index for this lore (following your chatStore pattern)
			await loreStore._updateSearchIndexForLore(loreInfo);

			return { loreId: loreInfo.loreId };
		} catch (error) {
			handleServiceError(error, `Failed to store lore ${loreInfo.loreId}`);
		}
	},

	/**
	 * Retrieves a single, fully reconstructed Lore object by its ID.
	 * Following your chatStore getChatTurn pattern exactly.
	 */
	getLore: async (loreId: string): Promise<LoreResponse> => {
		try {
			const collection = await loreStore._getCollection();

			// 1. Fetch the primary lore document and all its index records in one go.
			const loreAndIndexDocsResponse = await getRecords(collection, { loreId: { $eq: loreId } });

			const allDocs = validateChromaResponse(loreAndIndexDocsResponse, 'getList', collectionType);
			if (allDocs.ids.length === 0) {
				console.warn(`[getLore] No lore document found with ID: ${loreId}`);
				return emptyLoreRes;
			}

			// 2. Partition the results into the primary lore and its index records.
			let primaryLoreDoc: { id: string; document: string | null; metadata: Metadata | null } | null =
				null;
			const indexRecords: Metadata[] = [];

			// Use a standard 'for' loop to avoid closure-related type inference issues.
			for (let i = 0; i < allDocs.metadatas.length; i++) {
				const metadata = allDocs.metadatas[i];
				if (metadata) {
					if (metadata.type === METADATA_TYPES.WORLD || metadata.type === METADATA_TYPES.LORE) {
						primaryLoreDoc = { id: allDocs.ids[i], document: allDocs.documents[i], metadata: metadata };
					} else if (metadata.type === METADATA_TYPES.INDEX) {
						indexRecords.push(metadata);
					}
				}
			}

			// Ensure the primary lore document was actually found.
			if (!primaryLoreDoc || !primaryLoreDoc.metadata) {
				console.warn(`[getLore] Primary lore data for ID '${loreId}' is missing or corrupt.`);
				return emptyLoreRes;
			}

			// 3. Reconstruct the single full, rich object.
			const loreInfo = metadataToLore(
				primaryLoreDoc.metadata as unknown as LoreMetadata,
				primaryLoreDoc.document || '',
				indexRecords as unknown as LoreIndexMetadata[]
			);

			// 4. Return the complete LoreResponse object for the single lore.
			return {
				ids: [primaryLoreDoc.id],
				documents: [primaryLoreDoc.document],
				metadatas: [toChromaMetadata(primaryLoreDoc.metadata)],
				loreInfos: [loreInfo],
				loreInfo: loreInfo,
				loreContent: loreInfo.content,
				loreContents: [loreInfo.content],
			};
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred in [getLore].',
				`Failed to get lore for ID ${loreId}`,
				{ suppress404: true }
			);
		}
	},

	/**
	 * Get all lores for a specific character by searching the index records.
	 * This version is optimized to reduce database calls.
	 */
	getLoresByCharacter: async (characterId: string): Promise<LoreResponse> => {
		try {
			const collection = await loreStore._getCollection();

			// Step 1: Find all INDEX records where the 'value' is the character's ID.
			// Your logic here is correct.
			const indexWhere: Where = {
				$and: [
					{ type: { $eq: METADATA_TYPES.INDEX } },
					{ contentType: { $eq: 'AFFECTED_CHARACTER' } },
					{ value: { $eq: characterId } }, // Using $eq for a single ID is slightly more direct
				],
			};

			const rawIndexResults = await getRecords(collection, indexWhere);
			const indexResults = validateChromaResponse(rawIndexResults, 'getList', collectionType);

			if (indexResults.ids.length === 0) {
				return emptyLoreRes;
			}

			// Step 2: Get a unique list of loreIds from the found index records.
			const loreIds = [
				...new Set(
					indexResults.metadatas.map((m) => (m as unknown as LoreIndexMetadata).loreId).filter(Boolean)
				),
			];

			if (loreIds.length === 0) {
				return emptyLoreRes;
			}

			// --- OPTIMIZATION: Fetch all data in batches instead of a loop ---

			// Step 3: Fetch all primary LORE/WORLD documents for the found loreIds in one call.
			const primaryDocsWhere: Where = { loreId: { $in: loreIds } };
			const rawPrimaryResults = await getRecords(collection, primaryDocsWhere);
			const primaryResults = validateChromaResponse(rawPrimaryResults, 'getList', collectionType);

			// Filter for only primary doc types, just in case index records were returned
			const primaryMetadatas = primaryResults.metadatas.filter(
				(m) => m?.type === METADATA_TYPES.LORE || m?.type === METADATA_TYPES.WORLD
			);
			if (primaryMetadatas.length === 0) return emptyLoreRes;

			// Step 4: Fetch ALL index records for these lores to enable full reconstruction.
			const allIndexWhere: Where = {
				$and: [{ type: { $eq: METADATA_TYPES.INDEX } }, { loreId: { $in: loreIds } }],
			};
			const rawAllIndexResults = await getRecords(collection, allIndexWhere);
			const allIndexRecords = validateChromaResponse(rawAllIndexResults, 'getList', collectionType)
				.metadatas as unknown as LoreIndexMetadata[];

			// --- END OPTIMIZATION ---

			// Step 5: Reconstruct the rich LoreInfo objects in memory.
			const allLoreInfos = primaryResults.metadatas
				.map((metadata, i) => {
					if (metadata?.type !== METADATA_TYPES.LORE && metadata?.type !== METADATA_TYPES.WORLD)
						return null;

					const loreMetadata = metadata as unknown as LoreMetadata;
					const relatedIndexRecords = allIndexRecords.filter(
						(record) => record.loreId === loreMetadata.loreId
					);

					return metadataToLore(loreMetadata, primaryResults.documents[i] || '', relatedIndexRecords);
				})
				.filter(Boolean) as LoreInfo[]; // Filter out any nulls

			// Step 6: Return the final, combined response.
			return {
				ids: allLoreInfos.map((l) => l.loreId),
				metadatas: allLoreInfos.map((l) => loreToMetadata(l)) as unknown as Metadata[],
				documents: allLoreInfos.map((l) => l.content),
				loreInfos: allLoreInfos,
				loreInfo: allLoreInfos[0] || null,
				loreContent: allLoreInfos[0]?.content || '',
				loreContents: allLoreInfos.map((l) => l.content),
			};
		} catch (error) {
			handleServiceError(error, `Failed to get lores for character ${characterId}`);
			return emptyLoreRes;
		}
	},

	/**
	 * Get world lores (category = 'World')
	 */
	getWorldLores: async (userId?: string): Promise<LoreResponse> => {
		try {
			const collection = await loreStore._getCollection();

			const whereConditions: Where[] = [
				{ type: { $eq: METADATA_TYPES.WORLD } }, // World lore type
				{ category: { $eq: 'World' } },
			];

			if (userId) {
				whereConditions.push({ userId: { $eq: userId } });
			}

			const where: Where = { $and: whereConditions };

			const rawResults = await getRecords(collection, where);
			const results = validateChromaResponse(rawResults, 'getList', collectionType);

			if (results.ids.length === 0) return emptyLoreRes;

			// Reconstruct each world lore with its index records
			const worldLorePromises = results.ids.map((loreId) => loreStore.getLore(loreId));
			const worldLoreResponses = await Promise.all(worldLorePromises);

			const allWorldLores = worldLoreResponses
				.filter((response) => response.loreInfos.length > 0)
				.flatMap((response) => response.loreInfos);

			return {
				ids: allWorldLores.map((l) => l.loreId),
				metadatas: allWorldLores.map((l) => loreToMetadata(l)) as unknown as Metadata[],
				documents: allWorldLores.map((l) => l.content),
				loreInfos: allWorldLores,
				loreInfo: allWorldLores[0] || ({} as LoreInfo),
				loreContent: allWorldLores[0]?.content || '',
				loreContents: allWorldLores.map((l) => l.content),
			};
		} catch (error) {
			handleServiceError(error, `Failed to get world lores for user ${userId}`);
			return emptyLoreRes;
		}
	},

	/**
	 * Deletes a lore document and all its associated index entries.
	 */
	deleteLore: async (loreId: string): Promise<void> => {
		try {
			const collection = await loreStore._getCollection();
			console.log(`[LoreStore] Deleting lore and all associated indexes for loreId: ${loreId}`);

			// Delete primary document and all index records
			const whereFilter: Where = {
				$or: [
					{ loreId: { $eq: loreId } }, // Primary document
					{
						$and: [
							{ type: { $eq: METADATA_TYPES.INDEX } },
							{ loreId: { $eq: loreId } }, // Index records
						],
					},
				],
			};

			await deleteRecords(collection, undefined, whereFilter);
			console.log(`[LoreStore] Successfully deleted lore and indexes for loreId: ${loreId}`);
		} catch (error) {
			handleServiceError(error, `Failed to delete lore ${loreId}`);
		}
	},

	/**
	 * [For Backend RAG] Performs a hybrid semantic/metadata search for Lore entries.
	 */
	queryLores: async (
		characterIds: string | string[],
		queryTexts: string[],
		filterCriteria?: FilterCriteria,
		whereDocument?: WhereDocument,
		limit?: number
	): Promise<LoreResponse> => {
		try {
			const collection = await loreStore._getCollection();
			const charIdArray = Array.isArray(characterIds) ? characterIds : [characterIds];
			let loreIdsToSearch: string[] | undefined = undefined;

			// 1. Apply filter criteria to narrow down search space
			if (filterCriteria && Object.keys(filterCriteria).length > 0) {
				const indexWhereFilter = loreStore._buildIndexWhereClause(charIdArray, filterCriteria);
				if (indexWhereFilter) {
					const indexResults = await getRecords(collection, indexWhereFilter);
					const validatedIndexes = validateChromaResponse(indexResults, 'getList', collectionType);
					loreIdsToSearch = [
						...new Set(validatedIndexes.metadatas.map((m) => (m as unknown as LoreIndexMetadata).loreId)),
					];
					if (loreIdsToSearch.length === 0) return emptyLoreRes;
				}
			}

			// 2. Build query conditions for primary documents
			const queryConditions: Where[] = [
				{
					$or: [
						{ type: { $eq: METADATA_TYPES.WORLD } }, // World lore
						{ type: { $eq: METADATA_TYPES.LORE } }, // Misc lore
					],
				},
			];

			if (loreIdsToSearch) {
				queryConditions.push({ loreId: { $in: loreIdsToSearch } });
			}

			const queryWhere: Where = { $and: queryConditions };

			// 3. Perform semantic search
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

			// 4. Rank and limit results
			const rankedResults = reRankSemanticResults(validatedQueryResults, limit, {
				semanticWeight: 0.5,
				recencyWeight: 0.5,
				updatedAtField: 'updatedAt',
			});

			if (rankedResults.ids.length === 0) return emptyLoreRes;

			// 5. Reconstruct full objects with index records
			const lorePromises = rankedResults.ids.map((loreId) => loreStore.getLore(loreId));
			const loreResponses = await Promise.all(lorePromises);

			const loreInfos = loreResponses
				.filter((response) => response.loreInfos.length > 0)
				.flatMap((response) => response.loreInfos)
				.filter((lore) => {
					// Filter by character involvement
					return lore.characterIds.some((charId) => charIdArray.includes(charId));
				});

			return {
				ids: loreInfos.map((l) => l.loreId),
				metadatas: loreInfos.map((l) => loreToMetadata(l)) as unknown as Metadata[],
				documents: loreInfos.map((l) => l.content),
				loreInfos,
				loreInfo: loreInfos[0] || ({} as LoreInfo),
				loreContent: loreInfos[0]?.content || '',
				loreContents: loreInfos.map((r) => r.content),
			};
		} catch (error) {
			handleServiceError(error, `Failed to query lores for characters ${characterIds}`);
			return emptyLoreRes;
		}
	},

	/**
	 * Clear collection cache
	 */
	clearCollectionCache: (): void => {
		console.log('[LoreService] Clearing cached lore collection.');
		loreStore._loreCollection = null;
	},
};
