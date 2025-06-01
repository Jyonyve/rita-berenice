// src/server/services/recapService.ts

import {
	RecapMetadata,
	METADATA_TYPES,
	COLLECTIONS,
	parseSessionId,
	RecapResult,
	convertArrayToString,
} from '#shared/index.ts';
import { Collection } from 'chromadb';
import { chromaDbClient } from '../db/index.ts';

import {
	buildRecapDocId,
	buildRecapId,
	buildRelationshipRecapDocId,
	buildRelationshipRecapId,
	handleServiceError,
} from '../util/index.ts';

// Destructure chromaDbClient methods
const { getRecapCollection, upsertRecord, getRecordById, getRecords } = chromaDbClient;
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

	/**
	 * Store a factual recap with unified metadata structure
	 */
	storeFactualRecap: async (recapResult: RecapResult): Promise<void> => {
		if (!recapResult.content || recapResult.content.trim() === '') {
			console.warn(`[RecapService] Received empty recap content. Skipping factual recap.`);
			return;
		}

		const { sessionId, turnStart, turnEnd, model } = recapResult;
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
				keywords: convertArrayToString(recapResult.keywords),
				topics: convertArrayToString(recapResult.topics),
				entities: convertArrayToString(recapResult.entities),
				sequence: recapResult.turnEnd, // Use end as the sequence

				// Recap-specific fields (flattened)
				recapId: buildRecapId(sessionId, turnStart, turnEnd),
				turnStart,
				turnEnd,
				model,
			};

			const collection = await recapService._getCollection();
			await upsertRecord(collection, recapMetadata.recapId, recapResult.content, recapMetadata);
			// whole texts document
			await upsertRecord(collection, buildRecapDocId(sessionId), recapResult.content, {
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
	storeRelationshipRecap: async (recapResult: RecapResult): Promise<void> => {
		if (!recapResult.content || recapResult.content.trim() === '') {
			console.warn(`[RecapService] Received empty recap content. Skipping relationship recap.`);
			return;
		}
		const { sessionId, turnStart, turnEnd, model } = recapResult;
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
				keywords: convertArrayToString(recapResult.keywords),
				topics: convertArrayToString(recapResult.topics),
				entities: convertArrayToString(recapResult.entities),
				sequence: recapResult.turnEnd, // Use end as the sequence

				// Recap-specific fields (flattened)
				recapId: buildRelationshipRecapId(sessionId, turnStart, turnEnd),
				turnStart,
				turnEnd,
				model,
			};
			const collection = await recapService._getCollection();
			await upsertRecord(collection, recapMetadata.recapId, recapResult.content, recapMetadata);
			// whole texts document
			await upsertRecord(collection, buildRelationshipRecapDocId(sessionId), recapResult.content, {
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

	/**
	 * Clear collection cache
	 */
	clearCollectionCache: (): void => {
		console.log('[RecapService] Clearing cached recap collection.');
		recapService._recapCollection = null;
	},
};
