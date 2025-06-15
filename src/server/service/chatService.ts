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
	parseTextToEntries,
	TempChatTurnMetadata,
} from '#shared/index.ts';
import { Collection, IncludeEnum, Metadata, Where, WhereDocument } from 'chromadb';
import { chromaDbClient } from '../db/chromaDbClient.ts';
import {
	flatChatMessageToDoc,
	flatChatTurnToDoc,
	buildMessageId,
	buildChatTurnId,
	handleServiceError,
	validateChromaResponse,
	inflateChatTurnDoc,
} from '../util/index.ts';
import { chatTurnToMetadata, metadataToChatTurn } from '#root/src/shared/util/dbConvertUtils.ts';

// Destructure outside the object
const {
	getChatCollection,
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
	_chatCollection: null as Collection | null,
	_tempChatCollection: null as Collection | null,

	// Get collection methods with caching
	_getChatCollection: async (): Promise<Collection> => {
		if (chatService._chatCollection) return chatService._chatCollection;
		const collection = await getChatCollection();
		chatService._chatCollection = collection;
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

		const collection = await chatService._getChatCollection();
		try {
			const documentForEmbedding = flatChatMessageToDoc(request.entries);
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
		try {
			const collection = await chatService._getChatCollection();

			const documentForEmbedding = flatChatMessageToDoc(response.entries);
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
		const collection = await chatService._getChatCollection();
		const updatedMetadata: ChatTurnMetadata = chatTurnToMetadata(chatTurn);
		const documentForEmbedding = flatChatTurnToDoc(chatTurn);

		await upsertRecord(collection, updatedMetadata.chatTurnId, documentForEmbedding, updatedMetadata);
	},

	_constuctChatTurn: (results: ChromaResponse): ChatResponse => {
		const { ids, documents, metadatas } = results;
		const chatTurns = ids.map((id, index) => {
			const metadata = metadatas[index];
			const document = documents[index];
			const inflatedDoc = inflateChatTurnDoc(document!);
			const chatTurn = metadataToChatTurn(metadata!, inflatedDoc.request, inflatedDoc.response);
			return chatTurn;
		});
		return { ids, documents, metadatas, chatTurns, chatTurn: chatTurns[0] || null };
	},

	// --- Temporary Turn Operations ---
	saveTempChatTurn: async (tempData: TempChatTurn): Promise<void> => {
		// shoould get the document to get whole temp data
		const collection = await chatService._getTempCollection();
		const now = new Date().toISOString();
		const updatedMetadata: TempChatTurnMetadata = {
			type: METADATA_TYPES.TEMP,
			sequence: tempData.sequence,
			sessionId: tempData.sessionId,
			createdAt: tempData.createdAt || now,
			updatedAt: now,
			setCount: tempData.chatTurnSets?.length || 0,
		};
		await upsertRecord(collection, tempData.sessionId, JSON.stringify(tempData), updatedMetadata);
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
		queryTexts: string[],
		messageType: ChatMessageType,
		where?: Where,
		whereDocumennt?: WhereDocument,
		limit?: number
	): Promise<string[]> => {
		try {
			const collection = await chatService._getChatCollection();

			// Create a where clause that includes the specified message types
			const whereClause: Where = {
				$and: [
					{ sessionId: { $eq: sessionId } },
					{ type: { $eq: METADATA_TYPES.MESSAGE } },
					{ messageType: { $eq: messageType } },
					...(Array.isArray(where?.$and) ? where.$and : []),
				],
			};

			const rawResults = await queryRecords(
				collection,
				queryTexts,
				whereClause,
				whereDocumennt,
				limit
			);
			const results = rawResults.map((raw) => validateChromaResponse(raw, 'getList', collectionType));
			return results.flatMap((result) => {
				const chatMessages = result.documents
					.flatMap((doc) => (typeof doc === 'string' ? parseTextToEntries(doc) : []))
					.filter((msg) => msg !== null);

				return chatMessages.map((msg) => JSON.stringify(msg));
			});
		} catch (error) {
			console.error(`Failed to query chat log for session ${sessionId}:`, error);
			return [];
		}
	},

	queryChatTurns: async (
		sessionId: string,
		queryTexts: string[],
		where?: Where,
		whereDocument?: WhereDocument,
		limit?: number
	): Promise<ChatResponse> => {
		try {
			const collection = await chatService._getChatCollection();

			const whereClause: Where = {
				$and: [
					{ sessionId: { $eq: sessionId } },
					{ type: { $eq: METADATA_TYPES.TURN } },
					...(Array.isArray(where?.$and) ? where.$and : []),
				],
			};
			const rawResults = await queryRecords(collection, queryTexts, whereClause, whereDocument, limit);

			const results = rawResults.map((raw) => validateChromaResponse(raw, 'getList', collectionType));

			// Collect all results
			const allChatTurns: ChatTurn[] = [];
			const allIds: string[] = [];
			const allDocuments: (string | null)[] = [];
			const allMetadatas: (Metadata | null)[] = [];

			results.forEach((result) => {
				const { ids, documents, metadatas, chatTurns } = chatService._constuctChatTurn(result);
				allChatTurns.push(...chatTurns);
				allIds.push(...ids);
				allDocuments.push(...documents);
				allMetadatas.push(...metadatas);
			});

			// Return a single ChatResponse with all results merged
			return {
				ids: allIds,
				documents: allDocuments,
				metadatas: allMetadatas,
				chatTurns: allChatTurns,
				chatTurn: allChatTurns[0],
			};
		} catch (error) {
			console.error(`Failed to query chat log for session ${sessionId}:`, error);
			return { ids: [], documents: [], metadatas: [], chatTurns: [], chatTurn: {} as ChatTurn };
		}
	},

	/** Loads multiple FIXED turns  */
	getChatTurns: async (sessionId: string, beforeSequence: number): Promise<ChatResponse> => {
		const collection = await chatService._getChatCollection();
		const where: Where = { type: METADATA_TYPES.TURN, sessionId, sequence: { $lt: beforeSequence } };
		try {
			const rawResults = await getRecords(collection, where);
			const results = validateChromaResponse(rawResults, 'getList', collectionType);
			return chatService._constuctChatTurn(results);
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
		const collection = await chatService._getChatCollection();
		const turnId = buildChatTurnId(sessionId, sequence);
		try {
			const rawResult = await getRecordById(collection, turnId);
			const results = validateChromaResponse(rawResult, 'getOne', collectionType);
			return chatService._constuctChatTurn(results);
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [getChatTurnBySequence].',
				`Failed to get chat turn by sequence for session ${sessionId}:`
			);
		}
	},

	// Method to clear the cache if needed (e.g., for testing or memory management)
	clearChatCollectionCache: (): void => {
		chatService._chatCollection = null;
	},
	clearTempChatCollectionCache: (): void => {
		chatService._tempChatCollection = null;
	},
};
