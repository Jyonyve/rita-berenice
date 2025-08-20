// src/server/store/recapStore.ts

import { Collection, Where, WhereDocument } from 'chromadb';
import { COLLECTIONS } from '../db/ChromaInterfaces.js';
import { METADATA_TYPES } from '#shared/config/constants.js';
import { chromaDbClient } from '../db/chromaDbClient.js';
import { RecapResponse } from '#shared/api/ModuleResponse.js';
import { recapToMetadata, metadataToRecap } from '#shared/util/dbConvertUtils.js';
import {
	RecapInfo,
	RecapMetadata,
	RecapIndexMetadata,
	RecapIndexContentType,
} from '#shared/domain/recap/RecapInterfaces.js';
import { buildRecapIndexId } from '#shared/util/buildIdUtils.js';
import { handleServiceError, validateChromaResponse } from '../util/serviceHelpers.js';
import { FilterCriteria } from '../util/schemaUtils.js';
import { recapToDocument } from '../util/documentUtils.js';

// Destructure chromaDbClient methods
const {
	getRecapCollection,
	upsertRecord,
	upsertRecords,
	getRecords,
	queryRecords,
	deleteRecordById,
} = chromaDbClient;
const collectionType = COLLECTIONS.RECAP;

export const recapStore = {
	_recapCollection: null as Collection | null,

	async _getCollection(): Promise<Collection> {
		if (recapStore._recapCollection) {
			return recapStore._recapCollection;
		}
		const collection = await getRecapCollection();
		recapStore._recapCollection = collection;
		return collection;
	},

	/**
	 * @private
	 * Dynamically builds a ChromaDB 'where' clause to filter RECAP index documents.
	 */
	_buildIndexWhereClause(sessionId: string, criteria: FilterCriteria): Where | undefined {
		const orConditions: Where[] = [];

		// For recaps, the most relevant filter is likely emotion or specific keywords/flags.
		// We'll map the extracted criteria to the 'RECAP_FLAG' content type.
		const recapFlags = [...(criteria.keywords || []), ...(criteria.topics || [])];
		if (criteria.emotion) {
			recapFlags.push(criteria.emotion);
		}

		if (recapFlags.length > 0) {
			recapFlags.forEach((flag) => {
				orConditions.push({ $and: [{ contentType: { $eq: 'RECAP_FLAG' } }, { value: { $eq: flag } }] });
			});
		}

		if (orConditions.length === 0) {
			return undefined;
		}

		// The final clause finds any INDEX doc for the session that matches ANY of the flags.
		return {
			$and: [
				{ type: { $eq: METADATA_TYPES.INDEX } },
				{ sessionId: { $eq: sessionId } },
				{ $or: orConditions },
			],
		};
	},

	/**
	 * @private
	 * Manages the denormalized search index records for a given Recap.
	 */
	async _updateSearchIndexForRecap(recap: RecapInfo): Promise<void> {
		const collection = await recapStore._getCollection();

		// --- 1. CRITICAL FIX: Atomically delete all EXISTING INDEX entries for this recap ---
		const oldIndexWhere: Where = {
			$and: [{ type: { $eq: METADATA_TYPES.INDEX } }, { recapId: { $eq: recap.recapId } }],
		};
		await collection.delete({ where: oldIndexWhere });

		// --- 2. Create new index records with UNIQUE IDs ---
		const newIndexRecords: { id: string; metadata: RecapIndexMetadata; document: string }[] = [];
		const baseMetadata = {
			type: METADATA_TYPES.INDEX,
			recapId: recap.recapId,
			sessionId: recap.sessionId,
			characterId: recap.characterId,
		};

		const createIndexRecords = (list: string[], contentType: RecapIndexContentType) => {
			if (!list || list.length === 0) return;
			for (const value of list) {
				if (!value || value.trim() === '') continue;
				newIndexRecords.push({
					// --- CRITICAL FIX: Ensure ID is unique by including the value ---
					id: buildRecapIndexId(recap.recapId, contentType),
					metadata: { ...baseMetadata, contentType, value },
					document: value, // The flag/value itself is the content to be embedded
				});
			}
		};

		// Create index records for all filterable attributes
		createIndexRecords(recap.flagList, 'RECAP_FLAG');

		// --- 3. Batch upsert the new index records ---
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
	 * Reconstructs rich RecapInfo objects from primary documents and their index records.
	 */
	_constructFullRecaps(
		recapMetadatas: RecapMetadata[],
		recapDocuments: (string | null)[],
		allIndexRecords: RecapIndexMetadata[]
	): RecapInfo[] {
		return recapMetadatas.map((metadata, i) => {
			const relatedIndexRecords = allIndexRecords.filter(
				(record) => record.recapId === metadata.recapId
			);
			return metadataToRecap(metadata, recapDocuments[i] || '', relatedIndexRecords);
		});
	},

	/**
	 * Stores a recap and updates its search index.
	 * This is the single, authoritative method for saving a recap.
	 */
	async storeRecap(recapInfo: RecapInfo): Promise<void> {
		if (!recapInfo.content || recapInfo.content.trim() === '') {
			console.warn(
				`[RecapStore] Received empty content. Skipping recap for session ${recapInfo.sessionId}.`
			);
			return;
		}

		try {
			const collection = await recapStore._getCollection();
			// 1. Convert the rich object to the flat metadata for the primary document.
			const metadata = recapToMetadata(recapInfo);
			// 2. Prepare the document content for embedding.
			const document = recapToDocument(recapInfo);

			// 3. Upsert the primary RECAP document.
			await upsertRecords(collection, [metadata.recapId], [document], [metadata]);

			// 4. Update its denormalized search indexes.
			await recapStore._updateSearchIndexForRecap(recapInfo);
		} catch (error) {
			handleServiceError(error, `Failed to store recap ${recapInfo.recapId}`);
		}
	},

	/**
	 * Retrieves all recaps for a given session, reconstructing the full rich objects.
	 */
	async getRecapsBySessionId(
		sessionId: string,
		type: typeof METADATA_TYPES.RECAP | typeof METADATA_TYPES.RELATIONSHIP
	): Promise<RecapInfo[]> {
		try {
			const collection = await recapStore._getCollection();

			// 1. Fetch primary RECAP/RELATIONSHIP documents
			const primaryResults = await getRecords(collection, {
				$and: [{ type: { $eq: type } }, { sessionId: { $eq: sessionId } }],
			});
			const primaryDocs = validateChromaResponse(primaryResults, 'getList', collectionType);
			if (primaryDocs.ids.length === 0) return [];

			// 2. Fetch all associated search index records
			const recapIds = primaryDocs.ids;
			const indexWhere: Where = {
				$and: [{ type: { $eq: METADATA_TYPES.INDEX } }, { recapId: { $in: recapIds } }],
			};
			const indexResults = await getRecords(collection, indexWhere);
			const allIndexRecords = validateChromaResponse(indexResults, 'getList', collectionType);

			// 3. Reconstruct the full rich objects
			return primaryDocs.metadatas.map((metadata, i) => {
				const relatedIndexMetadatas = allIndexRecords.metadatas.filter(
					(record) => !!record && record.recapId === (metadata as unknown as RecapMetadata).recapId
				);
				return metadataToRecap(
					metadata as unknown as RecapMetadata,
					primaryDocs.documents[i] || '',
					relatedIndexMetadatas as unknown as RecapIndexMetadata[]
				);
			});
		} catch (error) {
			handleServiceError(error, `Failed to get recaps for session ${sessionId}`);
			return [];
		}
	},

	/**
	 * [For Backend RAG] Performs a hybrid semantic/metadata search for Recaps.
	 */
	async queryRecaps(
		sessionId: string,
		queryTexts: string[],
		type: typeof METADATA_TYPES.RECAP | typeof METADATA_TYPES.RELATIONSHIP,
		filterCriteria?: FilterCriteria, // Changed parameter
		whereDocument?: WhereDocument,
		limit?: number
	): Promise<RecapInfo[]> {
		try {
			const collection = await recapStore._getCollection();
			let recapIdsToSearch: string[] | undefined = undefined;

			// Step 1: Pre-filter using the index to get relevant recap IDs.
			if (filterCriteria && Object.keys(filterCriteria).length > 0) {
				const indexWhereFilter = recapStore._buildIndexWhereClause(sessionId, filterCriteria);
				if (indexWhereFilter) {
					console.log('[recapStore] Querying RECAP INDEX docs with:', JSON.stringify(indexWhereFilter));
					const indexResults = await getRecords(collection, indexWhereFilter);
					const validatedIndexes = validateChromaResponse(indexResults, 'getList', collectionType);
					recapIdsToSearch = [
						...new Set(
							validatedIndexes.metadatas.map((m) => (m as unknown as RecapIndexMetadata).recapId)
						),
					];

					if (recapIdsToSearch.length === 0) {
						return [];
					}
					console.log(`[recapStore] Pre-filtered to ${recapIdsToSearch.length} recaps.`);
				}
			}

			// Step 2: Perform semantic search on the pre-filtered set of primary documents.
			const queryConditions: Where[] = [{ type: { $eq: type } }, { sessionId: { $eq: sessionId } }];
			if (recapIdsToSearch) {
				queryConditions.push({ recapId: { $in: recapIdsToSearch } });
			}
			const queryWhere: Where = { $and: queryConditions };

			console.log('[recapStore] Querying RECAP docs with:', JSON.stringify(queryWhere));
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
			const recapMetadatas = validatedQueryResults.flatMap((r) => r.metadatas);
			const recapDocuments = validatedQueryResults.flatMap((r) => r.documents);

			if (recapMetadatas.length === 0) {
				return [];
			}

			// Step 3: Fetch all index records for the final set of recaps.
			const finalRecapIds = recapMetadatas
				.map((m) => m?.recapId)
				.filter((id): id is string => typeof id === 'string');
			const finalIndexResults = await getRecords(collection, { recapId: { $in: finalRecapIds } });
			const allIndexRecords = validateChromaResponse(finalIndexResults, 'getList', collectionType);

			// Step 4: Reconstruct the full rich objects.
			return recapStore._constructFullRecaps(
				recapMetadatas as unknown as RecapMetadata[],
				recapDocuments,
				allIndexRecords as unknown as RecapIndexMetadata[]
			);
		} catch (error) {
			handleServiceError(error, `Failed to query recaps for session ${sessionId}`);
		}
	},
};
