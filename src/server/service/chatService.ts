import type { ChatTurn, ChatMessageType, TempChatTurn } from '#root/src/shared/domain/index.ts';
import {
	parseEntriesToText,
	buildMessageId,
	buildTurnId,
	DEFAULT_LOADING_TURN_COUNT,
	DEFAULT_RECAP_INTERVAL,
	DEFAULT_RECENT_TURN_COUNT,
	METADATA_TYPES,
	DEFAULT_RELATIONSHIP_RECAP_INTERVAL,
	COLLECTIONS,
} from '#root/src/shared/index.ts';
import { Collection, IncludeEnum, Where } from 'chromadb';
import { chromaDbClient, ChromaResponse } from '../db/chromaDbClient.ts';
import {
	buildChatMessageDocument,
	buildChatTurnDocument,
	validateResult,
	validateServiceId,
} from '../util/index.ts';
import { recapService } from './recapService.ts';

// Destructure outside the object
const {
	getSessionCollection,
	getTempChatCollection,
	upsertRecord,
	getRecordById,
	getRecords,
	deleteRecordById,
	queryRecords,
} = chromaDbClient;

interface ChatChromaResponse extends ChromaResponse {
	chatTurns: ChatTurn[];
}

export const chatService = {
	// Cache for session collections
	_sessionCollections: new Map<string, Collection>(),
	_tempChatCollection: null as Collection | null,

	// Get collection methods with caching
	_getCollection: async (sessionId: string): Promise<Collection> => {
		const cached = chatService._sessionCollections.get(sessionId);
		if (cached) return cached;
		const collection = await getSessionCollection(sessionId);
		chatService._sessionCollections.set(sessionId, collection);
		return collection;
	},
	_getTempCollection: async (): Promise<Collection> => {
		if (chatService._tempChatCollection) return chatService._tempChatCollection;
		const collection = await getTempChatCollection();
		chatService._tempChatCollection = collection;
		return collection;
	},

	// store fixed chat turn as json string
	_storeFullChatTurn: async (chatTurn: ChatTurn): Promise<void> => {
		const { sessionId, sequence, request } = chatTurn;
		const collection = await chatService._getCollection(sessionId);
		const turnId = buildTurnId(sessionId, sequence);
		const documentForEmbedding = buildChatTurnDocument(chatTurn);
		await upsertRecord(collection, turnId, documentForEmbedding, {
			...chatTurn,
			timestamp: request.timestamp,
		});
	},

	_parseMetadataToChatTurns: (metadatas: (Record<string, any> | null)[]): ChatTurn[] => {
		return metadatas
			.map((meta, index) => {
				if (!meta || meta.type !== METADATA_TYPES.SET) {
					return null;
				}
				try {
					return meta;
				} catch (e) {
					console.error(`Failed to parse chat turn for ID ${meta}:`, e);
					return null;
				}
			})
			.filter((t): t is ChatTurn => t !== null);
	},

	_checkAndGetRecapTurns: async (
		sessionId: string,
		sequence: number,
		interval: number
	): Promise<ChatTurn[]> => {
		// validation
		validateServiceId(sessionId, COLLECTIONS.CHAT);
		if (sequence === 0 || sequence % DEFAULT_RECAP_INTERVAL !== 0) return [];
		console.log(`Attempting to generate recap for session ${sessionId}, sequence ${sequence}`);

		const turnsForRecap = await chatService.getRecentChatTurns(sessionId, interval);
		if (!turnsForRecap) {
			console.warn(`No turns found for recap generation (Session: ${sessionId}, Seq: ${sequence})`);
			return [];
		}
		return turnsForRecap.chatTurns;
	},

	// --- Temporary Turn Operations ---
	saveTempChatTurn: async (tempData: TempChatTurn): Promise<void> => {
		if (!tempData.sessionId || !tempData.chatTurnSets) throw new Error('Invalid temp chat data.');

		const collection = await chatService._getTempCollection();
		await upsertRecord(collection, tempData.sessionId, JSON.stringify(tempData), {
			type: METADATA_TYPES.TEMP,
			sessionId: tempData.sessionId,
			timestamp: new Date().toISOString(),
			setCount: tempData.chatTurnSets?.length ?? 0,
		});
		console.log(`Stored temp data for session ${tempData.sessionId}`);
	},

	getTempChatTurn: async (sessionId: string): Promise<TempChatTurn | null> => {
		validateServiceId(sessionId, COLLECTIONS.CHAT);
		try {
			const collection = await chatService._getTempCollection(); // Assumes _getTempCollection exists
			const result = await chromaDbClient.getRecordById(collection, sessionId);
			if (!result.documents[0]) return null;
			return JSON.parse(result.documents[0]) as TempChatTurn;
		} catch (error) {
			console.error(`Error fetching or parsing temp turn for session ${sessionId}:`, error);
			return null;
		}
	},

	removeTempChatTurn: async (sessionId: string): Promise<void> => {
		validateServiceId(sessionId, COLLECTIONS.CHAT);
		try {
			const collection = await chatService._getTempCollection();
			await deleteRecordById(collection, sessionId);
			console.log(`Deleted temp data for session ${sessionId}`);
		} catch (error) {
			throw new Error('fail to delete temporary chat turn');
		}
	},

	// Store request (public for non-regen editing)
	storeRequest: async (chatTurn: ChatTurn): Promise<void> => {
		const { sessionId, sequence, request } = chatTurn;
		const collection = await chatService._getCollection(sessionId);
		const documentForEmbedding = buildChatMessageDocument(chatTurn, 'request');
		const requestId = buildMessageId(sessionId, sequence, 'request');
		await upsertRecord(collection, requestId, documentForEmbedding, {
			sessionId,
			sequence,
			...request,
		});
	},

	// Store response (public for non-regen editing)
	storeResponse: async (chatTurn: ChatTurn): Promise<void> => {
		const { sessionId, sequence, response } = chatTurn;
		const collection = await chatService._getCollection(sessionId);
		const documentForEmbedding = buildChatMessageDocument(chatTurn, 'response');
		const responseId = buildMessageId(sessionId, sequence, 'response');
		await upsertRecord(collection, responseId, documentForEmbedding, {
			sessionId,
			sequence,
			...response,
		});
	},

	// Chat Turn Operations
	storeChatTurn: async (chatTurn: ChatTurn): Promise<void> => {
		// validation
		if (!chatTurn || typeof chatTurn.sequence !== 'number' || !chatTurn.sessionId) {
			throw new Error('Invalid ChatTurn data received.');
		}
		const { sequence, sessionId } = chatTurn;
		await chatService.storeRequest(chatTurn);
		await chatService.storeResponse(chatTurn);

		// Store the full turn as JSON only when it's fixed
		await chatService._storeFullChatTurn(chatTurn);
		await chatService.removeTempChatTurn(sessionId);

		// check and store recap
		const recapTurns = await chatService._checkAndGetRecapTurns(
			sessionId,
			sequence,
			DEFAULT_RECAP_INTERVAL
		);
		if (recapTurns.length > 0) {
			await recapService.storeRecap(sessionId, recapTurns);
		}
		const relationRecapTurns = await chatService._checkAndGetRecapTurns(
			sessionId,
			sequence,
			DEFAULT_RELATIONSHIP_RECAP_INTERVAL
		);
		if (relationRecapTurns.length > 0) {
			await recapService.storeRelationshipRecap(sessionId, relationRecapTurns);
		}
	},

	// Enhanced Query Operations
	queryIndividualChatLogs: async (
		sessionId: string,
		messageType: ChatMessageType,
		queryText: string,
		limit?: number
	): Promise<string[]> => {
		validateServiceId(sessionId, COLLECTIONS.CHAT);
		const collection = await chatService._getCollection(sessionId);
		try {
			// Create a where clause that includes the specified message types
			const whereClause: Where = { type: METADATA_TYPES.MESSAGE, sessionId, messageType };
			const results = await queryRecords(collection, queryText, whereClause, limit ?? -1);
			return results.flatMap((result) => result.documents.filter((doc) => doc !== null));
		} catch (error) {
			console.error(`Failed to query chat log for session ${sessionId}:`, error);
			return [];
		}
	},

	queryChatTurnDocs: async (
		sessionId: string,
		queryText: string,
		limit?: number
	): Promise<string[]> => {
		validateServiceId(sessionId, COLLECTIONS.CHAT);
		const collection = await chatService._getCollection(sessionId);
		try {
			// Create a where clause that includes the specified message types
			const whereClause: Where = { type: METADATA_TYPES.SET, sessionId };
			const results = await queryRecords(collection, queryText, whereClause, limit ?? -1);
			return results.flatMap((result) => result.documents.filter((doc) => doc !== null));
		} catch (error) {
			console.error(`Failed to query chat log for session ${sessionId}:`, error);
			return [];
		}
	},

	/** Loads multiple FIXED turns (for inifinity scroll, history view) */
	getLoadingChatTurns: async (
		sessionId: string,
		beforeSequence: number,
		limit: number = DEFAULT_LOADING_TURN_COUNT
	): Promise<ChatChromaResponse | null> => {
		//validation
		validateServiceId(sessionId, COLLECTIONS.CHAT);
		if (typeof beforeSequence !== 'number' || beforeSequence < 0) {
			throw new Error('A valid beforeSequence number is required.');
		}

		const collection = await chatService._getCollection(sessionId);
		try {
			const whereClause: Record<string, any> = {
				type: METADATA_TYPES.SET,
				sessionId,
				sequence: { $lt: beforeSequence }, // Fetch turns strictly less than the marker
			};
			const results = await collection.get({
				where: whereClause,
				include: [IncludeEnum.Documents, IncludeEnum.Metadatas],
				// We cannot reliably use limit/offset here to get the *highest* sequences < beforeSequence.
			});

			if (validateResult(results)) {
				const { ids, documents, metadatas } = results;

				const parsedTurns = chatService._parseMetadataToChatTurns(metadatas);
				parsedTurns.sort((a, b) => b.sequence - a.sequence);
				const limitedTurns = parsedTurns.slice(0, limit);
				return { ids, documents, metadatas, chatTurns: limitedTurns.reverse() };
			}
			console.warn(`failed to getLoadingChatTurns, beforSequence : ${beforeSequence}`);
			return null;
		} catch (error) {
			console.error(
				`Error fetching chat turns before ${beforeSequence} for session ${sessionId}:`,
				error
			);
			return null; // Return empty array on error
		}
	},

	/** Loads multiple FIXED turns */
	getRecentChatTurns: async (
		sessionId: string,
		limit: number = DEFAULT_RECENT_TURN_COUNT
	): Promise<ChatChromaResponse | null> => {
		validateServiceId(sessionId, COLLECTIONS.CHAT);

		const collection = await chatService._getCollection(sessionId);
		try {
			const whereClause: Where = {
				type: METADATA_TYPES.SET, // Only fetch fixed, full turn documents
				sessionId,
			};
			// Fetch FULL_TURN documents, sort by sequence descending, take limit
			const results = await getRecords(collection, whereClause);
			if (validateResult(results)) {
				const { ids, documents, metadatas } = results;

				const parsedTurns = chatService._parseMetadataToChatTurns(metadatas);
				parsedTurns.sort((a, b) => b.sequence - a.sequence);
				const limitedTurns = parsedTurns.slice(0, limit);
				return { ids, documents, metadatas, chatTurns: limitedTurns.reverse() };
			}
			console.warn(`fail to get recent chat turns condition: ${whereClause}`);
			return null;
			//return part
		} catch (error) {
			console.error(`Error fetching recent fixed turns for session ${sessionId}:`, error);
			return null;
		}
	},

	/** Gets a single FIXED turn by sequence */
	getChatTurnBySequence: async (sessionId: string, sequence: number): Promise<ChatTurn | null> => {
		validateServiceId(sessionId, COLLECTIONS.CHAT);
		const collection = await chatService._getCollection(sessionId);
		const turnId = buildTurnId(sessionId, sequence);
		try {
			const turnJson = await getRecordById(collection, turnId);
			return turnJson ? (turnJson as unknown as ChatTurn) : null;
		} catch (error) {
			console.error(
				`Error fetching recent fixed turn sequence ${sequence} for session ${sessionId}:`,
				error
			);
			return null;
		}
	},

	// Method to clear the cache if needed (e.g., for testing or memory management)
	clearCollectionCache: (sessionId?: string): void => {
		if (sessionId) {
			chatService._sessionCollections.delete(sessionId);
		} else {
			chatService._sessionCollections.clear();
		}
	},
};
