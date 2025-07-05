import { Collection, Metadata, Where, WhereDocument } from 'chromadb';
import { chromaDbClient } from '../db/chromaDbClient.js';

import { COLLECTIONS } from '../db/ChromaInterfaces.js';
import { METADATA_TYPES } from '#shared/config/constants.js';
import { TempChatTurn, TempChatTurnMetadata } from '#shared/domain/chat/ChatInterfaces.js';
import { buildTempChatTurnId } from '../util/buildIdUtils.js';

import { handleServiceError, validateChromaResponse } from '../util/serviceHelpers.js';
import { ChatResponse, ChromaResponse, TempChatResponse } from '#shared/api/ModuleResponse.js';

// Destructure outside the object
const { getTempChatCollection, upsertRecord, getRecords } = chromaDbClient;
const collectionType = COLLECTIONS.TEMP;

export const tempStore = {
	// Cache for session collections
	_tempChatCollection: null as Collection | null,

	_getTempCollection: async (): Promise<Collection> => {
		if (tempStore._tempChatCollection) return tempStore._tempChatCollection;
		const collection = await getTempChatCollection();
		tempStore._tempChatCollection = collection;
		return collection;
	},

	_constructTempChatTurn: (results: ChromaResponse): TempChatResponse => {
		const { ids, documents, metadatas } = results;

		const tempChatTurns = documents
			.map((doc, index) => {
				if (typeof doc === 'string') {
					try {
						// The entire TempChatTurn is stored as a JSON string in the document.
						return JSON.parse(doc) as TempChatTurn;
					} catch (e) {
						console.error(`Failed to parse TempChatTurn document for ID ${ids[index]}:`, e);
						return null;
					}
				}
				return null;
			})
			.filter((turn): turn is TempChatTurn => turn !== null);

		return { ids, documents, metadatas, tempChatTurns, tempChatTurn: tempChatTurns[0] ?? null };
	},

	// --- Temporary Turn Operations ---
	saveTempChatTurn: async (tempData: TempChatTurn): Promise<void> => {
		// shoould get the document to get whole temp data
		const collection = await tempStore._getTempCollection();
		const now = new Date().toISOString();
		const updatedMetadata: TempChatTurnMetadata = {
			type: METADATA_TYPES.TEMP,
			sequence: tempData.sequence,
			sessionId: tempData.sessionId,
			createdAt: tempData.createdAt || now,
			updatedAt: now,
			setCount: tempData.chatTurnSets.length || 0,
			tempTurnId: tempData.tempTurnId || buildTempChatTurnId(tempData.sessionId, tempData.sequence),
			fixedSetNo: tempData.fixedSetNo,
		};

		const documentObj: TempChatTurn = { ...updatedMetadata, chatTurnSets: tempData.chatTurnSets };
		await upsertRecord(collection, tempData.sessionId, JSON.stringify(documentObj), updatedMetadata);
		console.log(`Stored temp data for session ${tempData.sessionId}`);
	},

	getTempChatTurn: async (sessionId: string, sequence: number): Promise<TempChatResponse> => {
		try {
			const collection = await tempStore._getTempCollection(); // Assumes _getTempCollection exists
			const rawResult = await chromaDbClient.getRecordById(
				collection,
				buildTempChatTurnId(sessionId, sequence)
			);
			const result = validateChromaResponse(rawResult, 'getOne', collectionType);
			return tempStore._constructTempChatTurn(result);
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [getTempChatTurn].',
				`Error fetching or parsing temp turn for session ${sessionId}`
			);
		}
	},

	/**
	 * ✅ CORRECTED: Fetches the single most recent temporary chat turn for each session.
	 */
	getLastTempTurnsForSessions: async (sessionIds: string[]): Promise<TempChatResponse> => {
		if (!sessionIds || sessionIds.length === 0) {
			return {
				ids: [],
				documents: [],
				metadatas: [],
				tempChatTurns: [],
				tempChatTurn: {} as TempChatTurn,
			};
		}

		const collection = await tempStore._getTempCollection();
		try {
			const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

			const where: Where = {
				$and: [
					{ type: { $eq: METADATA_TYPES.TEMP } },
					{ sessionId: { $in: sessionIds } },
					{ updatedAt: { $gte: since } },
				],
			};

			const rawResults = await getRecords(collection, where);
			// We don't need to validate here if the constructor handles it.
			// const result = validateChromaResponse(rawResults, 'getList', COLLECTIONS.TEMP);

			// Use the new, correct constructor for TempChatTurn objects.
			const allTurnsResponse = tempStore._constructTempChatTurn(rawResults);

			const latestTurnMap = new Map<string, TempChatTurn>();

			// Iterate over the correctly parsed TempChatTurn objects.
			for (const turn of allTurnsResponse.tempChatTurns) {
				const existingTurn = latestTurnMap.get(turn.sessionId);
				if (!existingTurn || Date.parse(turn.updatedAt) > Date.parse(existingTurn.updatedAt)) {
					latestTurnMap.set(turn.sessionId, turn);
				}
			}

			const latestTurns = Array.from(latestTurnMap.values());
			latestTurns.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

			return {
				ids: latestTurns.map((t) => t.tempTurnId),
				documents: [], // Documents are not needed by the client, they are inside the turn objects.
				metadatas: [],
				tempChatTurns: latestTurns,
				tempChatTurn: latestTurns[0],
			};
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while fetching last temp turns for sessions.',
				`Failed to fetch last temp turns for sessions: ${sessionIds.join(', ')}`
			);
		}
	},

	clearTempChatCollectionCache: (): void => {
		tempStore._tempChatCollection = null;
	},
};
