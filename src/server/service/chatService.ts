import {
	ChatTurn,
	ChatMessageType,
	TempChatTurn,
	ChatMessage,
	ChatMessageMetadata,
	ChatTurnMetadata,
	METADATA_TYPES,
	COLLECTIONS,
	ChromaResponse,
	ChatResponse,
} from '#shared/index.ts';
import { Collection, IncludeEnum, Where } from 'chromadb';
import { chromaDbClient } from '../db/chromaDbClient.ts';
import {
	buildChatMessageDocument,
	buildChatTurnDocument,
	buildMessageId,
	buildChatTurnId,
	handleServiceError,
	validateChromaResponse,
} from '../util/index.ts';

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
const collectionType = COLLECTIONS.CHAT;

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

	// Store request (public for non-regen editing)
	_storeRequest: async (request: ChatMessage): Promise<ChatMessage> => {
		const { entries, model, ...requestMetadata } = request;
		const { sessionId, sequence, messageId } = requestMetadata;
		const now = new Date().toISOString();
		const updatedMetadata: ChatMessageMetadata = {
			...requestMetadata,
			messageId: messageId || buildMessageId(sessionId, sequence, 'request'),
			createdAt: request.createdAt || now,
			updatedAt: now,
			type: METADATA_TYPES.MESSAGE,
		};

		const collection = await chatService._getCollection(sessionId);
		try {
			const documentForEmbedding = buildChatMessageDocument(request.entries);
			await upsertRecord(collection, updatedMetadata.messageId, documentForEmbedding, updatedMetadata);
			return { entries, model, ...updatedMetadata };
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [storeRequest].',
				`Failed to store request message for session ${sessionId}:`
			);
		}
	},

	// Store response (public for non-regen editing)
	_storeResponse: async (response: ChatMessage): Promise<ChatMessage> => {
		const { entries, model, ...responseMetadata } = response;
		const { sessionId, sequence, messageId } = responseMetadata;
		const now = new Date().toISOString();
		const updatedMetadata: ChatMessageMetadata = {
			...responseMetadata,
			messageId: messageId || buildMessageId(sessionId, sequence, 'response'),
			createdAt: response.createdAt || now,
			updatedAt: now,
			type: METADATA_TYPES.MESSAGE,
		};

		const collection = await chatService._getCollection(sessionId);
		try {
			const documentForEmbedding = buildChatMessageDocument(response.entries);
			await upsertRecord(collection, updatedMetadata.messageId, documentForEmbedding, updatedMetadata);
			return { entries, model, ...updatedMetadata };
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [storeResponse].',
				`Failed to store response message for session ${sessionId}:`
			);
		}
	},

	// store fixed chat turn as json string
	_storeFullChatTurn: async (chatTurn: ChatTurn): Promise<void> => {
		const now = new Date().toISOString();
		const { request, response, ...chatTurnMetadata } = chatTurn;
		const { sessionId, sequence } = chatTurnMetadata;
		const collection = await chatService._getCollection(sessionId);
		const updatedMetadata: ChatTurnMetadata = {
			...chatTurnMetadata,
			chatTurnId: chatTurn.chatTurnId || buildChatTurnId(sessionId, sequence),
			requestMessageId: request.messageId,
			responseMessageId: response.messageId,
			createdAt: now,
			type: METADATA_TYPES.TURN,
		};
		const documentForEmbedding = buildChatTurnDocument(chatTurn);

		await chromaDbClient.upsertRecord(collection, chatTurn.chatTurnId, documentForEmbedding, {
			sessionId: chatTurn.sessionId,
			sequence: chatTurn.sequence,
			type: METADATA_TYPES.TURN,
			chatTurnId: chatTurn.chatTurnId,
		});

		await upsertRecord(collection, chatTurn.chatTurnId, documentForEmbedding, updatedMetadata);
	},

	_parseResMetaToChatTurnsString: (queryResults: ChromaResponse[]) => {
		return queryResults
			.flatMap((result) => {
				if (result.metadatas && result.metadatas.length > 0) {
					const firstMetadata = result.metadatas[0];

					if (
						firstMetadata &&
						typeof firstMetadata.fullTurnString === 'string' &&
						firstMetadata.fullTurnString.trim() !== ''
					) {
						return [firstMetadata.fullTurnString]; // Return as an array for flatMap
					}
				}
				return [];
			})
			.filter((turn) => !!turn);
	},

	// --- Temporary Turn Operations ---
	saveTempChatTurn: async (tempData: TempChatTurn): Promise<void> => {
		// shoould get the document to get whole temp data
		const collection = await chatService._getTempCollection();
		await upsertRecord(collection, tempData.sessionId, JSON.stringify(tempData), {
			type: METADATA_TYPES.TEMP,
			sequence: tempData.sequence,
			sessionId: tempData.sessionId,
			timestamp: new Date().toISOString(),
			setCount: tempData.chatTurnSets?.length || 0,
		});
		console.log(`Stored temp data for session ${tempData.sessionId}`);
	},

	getTempChatTurn: async (sessionId: string): Promise<TempChatTurn> => {
		try {
			const collection = await chatService._getTempCollection(); // Assumes _getTempCollection exists
			const rawResult = await chromaDbClient.getRecordById(collection, sessionId);
			const result = validateChromaResponse(rawResult, 'getOne', COLLECTIONS.TEMP);
			return JSON.parse(result.documents?.[0] ?? '') as TempChatTurn;
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [getTempChatTurn].',
				`Error fetching or parsing temp turn for session ${sessionId}`
			);
		}
	},

	removeTempChatTurn: async (sessionId: string): Promise<void> => {
		try {
			const collection = await chatService._getTempCollection();
			await deleteRecordById(collection, sessionId);
			console.log(`Deleted temp data for session ${sessionId}`);
		} catch (error) {
			throw new Error('fail to delete temporary chat turn');
		}
	},

	// Chat Turn Operations
	storeChatTurn: async (chatTurn: ChatTurn): Promise<string> => {
		const { sessionId, request, response, ...currentChatTurn } = chatTurn;
		try {
			const updatedRequest = await chatService._storeRequest(request);
			const updatedResponse = await chatService._storeResponse(response);
			const updatedChatTurn = {
				...currentChatTurn,
				sessionId,
				request: updatedRequest,
				response: updatedResponse,
			};
			// Store the full turn as JSON only when it's fixed
			await chatService._storeFullChatTurn(updatedChatTurn);
			await chatService.removeTempChatTurn(sessionId);
			return JSON.stringify(updatedChatTurn);
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [storeChatTurn].',
				`Failed to store chat turn for session ${sessionId}:`
			);
		}
	},

	// Enhanced Query Operations
	queryChatMessages: async (
		sessionId: string,
		queryText: string,
		messageType: ChatMessageType,
		limit?: number
	): Promise<string[]> => {
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

	queryChatTurnEntries: async (
		sessionId: string,
		queryText: string,
		limit?: number
	): Promise<string[]> => {
		const collection = await chatService._getCollection(sessionId); // Best practice: await here [1]
		try {
			const whereClause: Where = { type: METADATA_TYPES.TURN, sessionId };
			const queryResults = await queryRecords(collection, queryText, whereClause, limit ?? 50); // Use a sensible default for limit
			queryResults.forEach((result) => validateChromaResponse(result, 'getList', collectionType)); // Validate each result

			const chatTurnStrings = chatService._parseResMetaToChatTurnsString(queryResults);

			return chatTurnStrings;
		} catch (error) {
			handleServiceError(
				error,
				`Querying chat turn entries for session '${sessionId}' with query "${queryText.substring(0, 30)}..."`, // More context
				`Failed to query chat turn entries for session ${sessionId}.` // Client-facing message
			);
		}
	},

	/** Loads multiple FIXED turns  */
	getChatTurns: async (sessionId: string, beforeSequence: number): Promise<ChatResponse> => {
		const collection = await chatService._getCollection(sessionId);
		const where: Where = { type: METADATA_TYPES.TURN, sessionId, sequence: { $lt: beforeSequence } };
		try {
			const rawResults = await getRecords(collection, where, -1);
			const results = validateChromaResponse(rawResults, 'getList', collectionType);
			const { ids, documents, metadatas } = results;
			const chatTurns = chatService
				._parseResMetaToChatTurnsString([results])
				.map((turn) => JSON.parse(turn) as ChatTurn);
			return { ids, documents, metadatas, chatTurns };
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [getLoadingChatTurns].',
				`Failed to load chat turns for session ${sessionId}:`
			);
		}
	},

	/** Gets a single FIXED turn by sequence */
	getChatTurnBySequence: async (sessionId: string, sequence: number): Promise<ChatResponse> => {
		const collection = await chatService._getCollection(sessionId);
		const turnId = buildChatTurnId(sessionId, sequence);
		try {
			const rawResult = await getRecordById(collection, turnId);
			const results = validateChromaResponse(rawResult, 'getOne', collectionType);

			const parsedChatTurn = chatService._parseResMetaToChatTurnsString([results]);
			const chatTurns = parsedChatTurn.map((turn) => JSON.parse(turn) as ChatTurn);
			return {
				ids: results.ids,
				documents: results.documents,
				metadatas: results.metadatas,
				chatTurns: chatTurns,
				chatTurn: chatTurns[0],
			};
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [getChatTurnBySequence].',
				`Failed to get chat turn by sequence for session ${sessionId}:`
			);
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
