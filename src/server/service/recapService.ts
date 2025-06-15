// src/server/services/recapService.ts

import {
	RecapMetadata,
	METADATA_TYPES,
	COLLECTIONS,
	parseSessionId,
	RecapInfo,
	convertArrayToString,
	ChatTurn,
	RecapResponse,
	ChromaResponse,
	metadataToRecap,
} from '#shared/index.ts';
import { Collection, Metadata, Where, WhereDocument } from 'chromadb';
import { chromaDbClient } from '../db/index.ts';

import {
	buildRecapDocId,
	buildRecapId,
	buildRelationshipRecapDocId,
	buildRelationshipRecapId,
	handleServiceError,
	inflateRecapDoc,
	validateChromaResponse,
} from '../util/index.ts';
import { chatService } from './chatService.ts';

// Destructure chromaDbClient methods
const { getRecapCollection, upsertRecord, getRecordById, queryRecords } = chromaDbClient;
const collectionType = COLLECTIONS.RECAP;

export const recapService = {
	// Cache for recap collection
	_recapCollection: null as Collection | null,

	_getCollection: async (): Promise<Collection> => {
		if (recapService._recapCollection) {
			return recapService._recapCollection;
		}
		const collection = await getRecapCollection();
		recapService._recapCollection = collection;
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
			recapContents: recapInfos.map((r) => r.content),
			recapContent: recapInfos[0].content,
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

			const collection = await recapService._getCollection();
			await upsertRecord(collection, recapMetadata.recapId, recapInfo.content, recapMetadata);
			// whole texts document
			await upsertRecord(collection, buildRecapDocId(sessionId), recapInfo.content, {
				sessionId,
				type: METADATA_TYPES.DOCUMENT,
				timeStamp: now,
			});

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
			const collection = await recapService._getCollection();
			await upsertRecord(collection, recapMetadata.recapId, recapInfo.content, recapMetadata);
			// whole texts document
			await upsertRecord(collection, buildRelationshipRecapDocId(sessionId), recapInfo.content, {
				sessionId,
				type: METADATA_TYPES.DOCUMENT,
				timeStamp: now,
			});

			console.log(`[RecapService] Successfully stored relationship recap for session ${sessionId}`);
		} catch (error) {
			handleServiceError(
				error,
				`[RecapService] Internal error storing relationship recap, session ${sessionId}`,
				`Failed to store relationship recap for session ${sessionId}`
			);
		}
	},

	/**
	 * Get whole document recap for a session
	 */
	getRecapWholeDoc: async (
		sessionId: string,
		type: typeof METADATA_TYPES.RECAP | typeof METADATA_TYPES.RELATIONSHIP
	): Promise<string> => {
		const collection = await recapService._getCollection();
		const recapDocId =
			type === METADATA_TYPES.RECAP
				? buildRecapDocId(sessionId)
				: buildRelationshipRecapDocId(sessionId);
		console.log(`[RecapService] Fetching recap document for session ${sessionId}, type: ${type}`);

		try {
			const result = await getRecordById(collection, recapDocId);
			return result.documents?.[0] || '';
		} catch (error) {
			console.info(`[RecapService] No factual recap found for session ${sessionId}`);
			return '';
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
			const collection = await chatService._getChatCollection();

			const whereClause: Where = {
				$and: [
					{ sessionId: { $eq: sessionId } },
					{ type: { $eq: type } },
					...(Array.isArray(where?.$and) ? where.$and : []),
				],
			};
			const rawResults = await queryRecords(collection, queryTexts, whereClause, whereDocument, limit);

			const results = rawResults.map((raw) => validateChromaResponse(raw, 'getList', collectionType));

			// Collect all results
			const allRecapInfos: RecapInfo[] = [];
			const allIds: string[] = [];
			const allDocuments: (string | null)[] = [];
			const allMetadatas: (Metadata | null)[] = [];

			results.forEach((result) => {
				const { ids, documents, metadatas, recapInfos } = recapService._constuctRecap(result);
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
				recapInfo: allRecapInfos[0],
				recapContents: allRecapInfos.flatMap((r) => r.content),
				recapContent: allRecapInfos[0].content,
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
		recapService._recapCollection = null;
	},
};
