// src/server/services/recapStore.ts

import { Collection, Metadata, Where, WhereDocument } from 'chromadb';

import { chatStore } from './chatStore.js';
import { COLLECTIONS } from '../db/ChromaInterfaces.js';
import { METADATA_TYPES } from '#shared/config/constants.js';
import { chromaDbClient } from '../db/chromaDbClient.js';
import { ChromaResponse, RecapResponse } from '#shared/api/ModuleResponse.js';
import { flatRecapToDoc, inflateRecapDoc } from '../util/documentUtils.js';
import { metadataToRecap } from '#shared/util/dbConvertUtils.js';
import { RecapMetadata, RecapInfo } from '#shared/domain/recap/RecapInterfaces.js';
import { convertArrayToString, parseSessionId } from '#shared/util/chatParseUtils.js';
import {
	buildProfileId,
	buildRecapId,
	buildRelationshipRecapId,
} from '../../shared/util/buildIdUtils.js';
import { handleServiceError, validateChromaResponse } from '../util/serviceHelpers.js';
import { isAndWhere } from '../util/queryUtils.js';

// Destructure chromaDbClient methods
const { getRecapCollection, upsertRecord, getRecordById, queryRecords, getRecords } =
	chromaDbClient;
const collectionType = COLLECTIONS.RECAP;

export const recapStore = {
	// Cache for recap collection
	_recapCollection: null as Collection | null,

	_getCollection: async (): Promise<Collection> => {
		if (recapStore._recapCollection) {
			return recapStore._recapCollection;
		}
		const collection = await getRecapCollection();
		recapStore._recapCollection = collection;
		return collection;
	},

	_constuctRecap: (results: ChromaResponse): RecapResponse => {
		const { ids, documents, metadatas } = results;
		const recapInfos = ids.map((id, index) => {
			const metadata = metadatas[index];
			const document = documents[index];
			const inflatedDoc = inflateRecapDoc(document!);
			const recapInfo = metadataToRecap(metadata! as unknown as RecapMetadata, inflatedDoc.content);
			return recapInfo;
		});
		return {
			ids,
			documents,
			metadatas,
			recapInfos,
			recapInfo: recapInfos[0] || null,
			recapContents: (recapInfos || []).map((r) => r.content),
			recapContent: recapInfos[0]?.content || '',
		};
	},

	/**
	 * Store a factual recap with unified metadata structure
	 */
	storeFactualRecap: async (recapInfo: RecapInfo): Promise<void> => {
		if (!recapInfo.content || recapInfo.content.trim() === '') {
			console.warn(`[RecapService] Received empty recap content. Skipping factual recap.`);
			return;
		}

		const { sessionId, turnStart, turnEnd, model } = recapInfo;
		const characterId = parseSessionId(sessionId).characterId;

		console.log(
			`[RecapService] Storing factual recap for session ${sessionId}, turns ${turnStart}-${turnEnd}`
		);

		try {
			const now = new Date().toISOString();
			const recapMetadata: RecapMetadata = {
				// Base metadata fields (unified)
				sessionId,
				characterId,
				userId: recapInfo.userId,
				profileId: buildProfileId(sessionId, recapInfo.userId),
				type: METADATA_TYPES.RECAP,
				createdAt: now,
				updatedAt: now,
				keywords: recapInfo.keywords,
				topics: recapInfo.topics,
				entities: recapInfo.entities,
				sequence: recapInfo.turnEnd, // Use end as the sequence

				// Recap-specific fields (flattened)
				recapId: recapInfo.recapId || buildRecapId(sessionId, turnStart, turnEnd),
				turnStart,
				turnEnd,
				model,
				loreReferences: JSON.stringify(recapInfo.loreReferencesArray),
				historyReferences: JSON.stringify(recapInfo.historyReferencesArray),
				flags: convertArrayToString(recapInfo.flagsArray),
			};

			const collection = await recapStore._getCollection();
			const documentForEmbedding = JSON.stringify({ content: recapInfo.content });
			// const documentForEmbedding = flatRecapToDoc(recapInfo);

			await upsertRecord(collection, recapMetadata.recapId, documentForEmbedding, recapMetadata);

			console.log(`[RecapService] Successfully stored factual recap for session ${sessionId}`);
		} catch (error) {
			handleServiceError(
				error,
				`[RecapService] Internal error storing factual recap, session ${sessionId}`,
				`Failed to store factual recap for session ${sessionId}`
			);
		}
	},

	/**
	 * Store a relationship recap (no LLM generation, just storage)
	 */
	storeRelationshipRecap: async (recapInfo: RecapInfo): Promise<void> => {
		if (!recapInfo.content || recapInfo.content.trim() === '') {
			console.warn(`[RecapService] Received empty recap content. Skipping relationship recap.`);
			return;
		}
		const { sessionId, turnStart, turnEnd, model } = recapInfo;
		const characterId = parseSessionId(sessionId).characterId;

		console.log(
			`[RecapService] Storing relationship recap for session ${sessionId}, turns ${turnStart}-${turnEnd}`
		);

		try {
			const now = new Date().toISOString();
			const recapMetadata: RecapMetadata = {
				// Base metadata fields (unified)
				sessionId,
				characterId,
				userId: recapInfo.userId,
				profileId: buildProfileId(sessionId, recapInfo.userId),
				type: METADATA_TYPES.RECAP,
				createdAt: now,
				updatedAt: now,
				keywords: recapInfo.keywords,
				topics: recapInfo.topics,
				entities: recapInfo.entities,
				sequence: recapInfo.turnEnd, // Use end as the sequence

				// Recap-specific fields (flattened)
				recapId: buildRelationshipRecapId(sessionId, turnStart, turnEnd),
				turnStart,
				turnEnd,
				model,
				loreReferences: JSON.stringify(recapInfo.loreReferencesArray),
				historyReferences: JSON.stringify(recapInfo.historyReferencesArray),
				flags: convertArrayToString(recapInfo.flagsArray),
			};
			const collection = await recapStore._getCollection();
			const documentForEmbedding = flatRecapToDoc(recapInfo);

			await upsertRecord(collection, recapMetadata.recapId, documentForEmbedding, recapMetadata);

			console.log(`[RecapService] Successfully stored relationship recap for session ${sessionId}`);
		} catch (error) {
			handleServiceError(
				error,
				`[RecapService] Internal error storing relationship recap, session ${sessionId}`,
				`Failed to store relationship recap for session ${sessionId}`
			);
		}
	},

	getRecap: async (recapId: string): Promise<RecapResponse> => {
		const collection = await recapStore._getCollection();
		try {
			const rawResult = await getRecordById(collection, recapId);
			const results = validateChromaResponse(rawResult, 'getOne', collectionType);
			return recapStore._constuctRecap(results);
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [getRecap].',
				`Failed to get profile with ID ${recapId}:`
			);
		}
	},

	getRecapsBySessionId: async (
		sessionId: string,
		type: typeof METADATA_TYPES.RECAP | typeof METADATA_TYPES.RELATIONSHIP
	): Promise<RecapResponse> => {
		const collection = await recapStore._getCollection();
		try {
			const where: Where = { $and: [{ type: { $eq: type } }, { sessionId: { $eq: sessionId } }] };
			const rawResults = await getRecords(collection, where);
			const results = validateChromaResponse(rawResults, 'getList', collectionType);
			return recapStore._constuctRecap(results);
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [getRecapsBySessionId].',
				`Failed to get recaps with ID ${sessionId}:`
			);
		}
	},

	queryRecaps: async (
		sessionId: string,
		queryTexts: string[],
		type: typeof METADATA_TYPES.RECAP | typeof METADATA_TYPES.RELATIONSHIP,
		where?: Where,
		whereDocument?: WhereDocument,
		limit?: number
	): Promise<RecapResponse> => {
		try {
			const collection = await chatStore._getChatCollection();

			const conditions: Where[] = [{ sessionId: { $eq: sessionId } }, { type: { $eq: type } }];
			if (where && isAndWhere(where)) {
				conditions.push(...where.$and);
			}
			const whereClause: Where = { $and: conditions };

			const rawResults = await queryRecords(collection, queryTexts, whereClause, whereDocument, limit);

			const results = rawResults.map((raw) => validateChromaResponse(raw, 'getList', collectionType));

			// Collect all results
			const allRecapInfos: RecapInfo[] = [];
			const allIds: string[] = [];
			const allDocuments: (string | null)[] = [];
			const allMetadatas: (Metadata | null)[] = [];

			results.forEach((result) => {
				const { ids, documents, metadatas, recapInfos } = recapStore._constuctRecap(result);
				allRecapInfos.push(...recapInfos);
				allIds.push(...ids);
				allDocuments.push(...documents);
				allMetadatas.push(...metadatas);
			});

			// Return a single ChatResponse with all results merged
			return {
				ids: allIds,
				documents: allDocuments,
				metadatas: allMetadatas,
				recapInfos: allRecapInfos,
				recapInfo: allRecapInfos[0] || null,
				recapContents: allRecapInfos.flatMap((r) => r.content),
				recapContent: allRecapInfos[0]?.content || '',
			};
		} catch (error) {
			console.error(`Failed to query chat log for session ${sessionId}:`, error);
			return {
				ids: [],
				documents: [],
				metadatas: [],
				recapInfos: [],
				recapInfo: {} as RecapInfo,
				recapContents: [],
				recapContent: '',
			};
		}
	},

	/**
	 * Clear collection cache
	 */
	clearCollectionCache: (): void => {
		console.log('[RecapService] Clearing cached recap collection.');
		recapStore._recapCollection = null;
	},
};
