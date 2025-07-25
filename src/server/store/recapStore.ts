// src/server/store/recapStore.ts

import { Collection, Where, WhereDocument } from 'chromadb';
import { COLLECTIONS } from '../db/ChromaInterfaces.js';
import { METADATA_TYPES } from '#shared/config/constants.js';
import { chromaDbClient } from '../db/chromaDbClient.js';
import { RecapResponse } from '#shared/api/ModuleResponse.js';
import { recapToDocument } from '#shared/util/documentUtils.ts';
import { recapToMetadata, metadataToRecap } from '#shared/util/dbConvertUtils.js';
import {
	RecapInfo,
	RecapMetadata,
	RecapIndexMetadata,
	RecapIndexContentType,
} from '#shared/domain/recap/RecapInterfaces.js';
import { buildRecapIndexId } from '#shared/util/buildIdUtils.js';
import { handleServiceError, validateChromaResponse } from '../util/serviceHelpers.js';

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
		if (this._recapCollection) {
			return this._recapCollection;
		}
		const collection = await getRecapCollection();
		this._recapCollection = collection;
		return collection;
	},

	/**
	 * @private
	 * Creates or updates the denormalized search index records for a given Recap.
	 */
	async _updateSearchIndexForRecap(recap: RecapInfo): Promise<void> {
		const collection = await this._getCollection();
		const recapId = recap.recapId;

		// 1. Atomically delete all existing index entries for this recap.
		await deleteRecordById(collection, recapId);

		const newIndexRecords: { id: string; metadata: RecapIndexMetadata }[] = [];
		const baseMetadata = {
			type: recap.type,
			recapId: recapId,
			sessionId: recap.sessionId,
			characterId: recap.characterId,
		};

		// Helper to create index records for flags
		const createIndexRecords = (list: string[], contentType: RecapIndexContentType) => {
			for (const value of list) {
				newIndexRecords.push({
					id: buildRecapIndexId(recapId, contentType),
					metadata: { ...baseMetadata, contentType, value },
				});
			}
		};

		// 2. Create new index records for every flag.
		createIndexRecords(recap.flagList, 'RECAP_FLAG');

		// 3. Batch upsert the new index records.
		if (newIndexRecords.length > 0) {
			await upsertRecords(
				collection,
				newIndexRecords.map((r) => r.id),
				[], // Documents not needed for index entries
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
			const collection = await this._getCollection();
			const metadata = recapToMetadata(recapInfo);
			const document = recapToDocument(recapInfo);

			await upsertRecord(collection, metadata.recapId, document, metadata);
			await this._updateSearchIndexForRecap(recapInfo);
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

			// 1. Fetch primary RECAP documents
			const recapResults = await getRecords(collection, {
				$and: [{ type: { $eq: type } }, { sessionId: { $eq: sessionId } }],
			});
			const { metadatas: recapMetadatas, documents: recapDocuments } = validateChromaResponse(
				recapResults,
				'getList',
				collectionType
			);

			if (recapMetadatas.length === 0) {
				return [];
			}

			// 2. Fetch all associated search index records
			const recapIds = recapMetadatas
				.map((m) => (m || {}).recapId)
				.filter((id): id is string => typeof id === 'string');
			const indexResults = await getRecords(collection, { recapId: { $in: recapIds } });
			const allIndexResult = validateChromaResponse(indexResults, 'getList', collectionType);

			// 3. Reconstruct the full rich objects
			return recapStore._constructFullRecaps(
				recapMetadatas as unknown as RecapMetadata[],
				recapDocuments,
				allIndexResult.metadatas as unknown as RecapIndexMetadata[]
			);
		} catch (error) {
			handleServiceError(error, `Failed to get recaps for session ${sessionId}`);
		}
	},

	/**
	 * [For Backend RAG] Performs a hybrid semantic/metadata search for Recaps.
	 */
	async queryRecaps(
		sessionId: string,
		queryTexts: string[],
		type: typeof METADATA_TYPES.RECAP | typeof METADATA_TYPES.RELATIONSHIP,
		whereFilter?: Where, // This filter is for the INDEX records
		whereDocument?: WhereDocument,
		limit?: number
	): Promise<RecapInfo[]> {
		try {
			const collection = await recapStore._getCollection();
			let recapIdsToSearch: string[] | undefined = undefined;

			// Step 1: Pre-filter using the index to get relevant recap IDs.
			if (whereFilter && Object.keys(whereFilter).length > 0) {
				const indexResults = await getRecords(collection, whereFilter);
				const validatedIndexes = validateChromaResponse(indexResults, 'getList', collectionType);
				recapIdsToSearch = [
					...new Set(
						validatedIndexes.metadatas.map((m) => (m as unknown as RecapIndexMetadata).recapId)
					),
				];

				if (recapIdsToSearch.length === 0) {
					return [];
				}
			}

			// Step 2: Perform semantic search on the pre-filtered set of primary documents.
			const queryConditions: Where[] = [{ type: { $eq: type } }, { sessionId: { $eq: sessionId } }];
			if (recapIdsToSearch) {
				queryConditions.push({ recapId: { $in: recapIdsToSearch } });
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
