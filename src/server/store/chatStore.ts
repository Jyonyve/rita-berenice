import { Collection, Metadata, Where, WhereDocument } from 'chromadb';
import { chromaDbClient } from '../db/chromaDbClient.js';

import { COLLECTIONS } from '../db/ChromaInterfaces.js';
import { METADATA_TYPES } from '#shared/config/constants.js';
import {
	ChatIndexContentType,
	ChatIndexMetadata,
	ChatMessage,
	ChatMessageMetadata,
	ChatMessageType,
	ChatTurn,
	ChatTurnMetadata,
	DisplayTurn,
	TempChatTurn,
	TempChatTurnMetadata,
} from '#shared/domain/chat/ChatInterfaces.js';
import { flatChatMessageToDoc, chatTurnToDocument } from '#shared/util/documentUtils.js';
import { handleServiceError, validateChromaResponse } from '../util/serviceHelpers.js';
import {
	chatTurnToMetadata,
	metadataToChatTurn,
	metadataToDisplayTurn,
} from '#shared/util/dbConvertUtils.js';
import { ChatResponse } from '#shared/api/ModuleResponse.js';
import { parseTextToEntries } from '#shared/util/chatParseUtils.js';
import { isAndWhere } from '../util/queryUtils.js';
import { c } from 'node_modules/vite/dist/node/moduleRunnerTransport.d-DJ_mE5sf.js';
import {
	buildChatTurnIndexId,
	buildChatTurnId,
	buildMessageId,
} from '#shared/util/buildIdUtils.js';

// Destructure outside the object
const {
	getChatCollection,
	upsertRecord,
	upsertRecords,
	getRecordById,
	getRecords,
	queryRecords,
	deleteRecordById,
	deleteRecords,
} = chromaDbClient;
const collectionType = COLLECTIONS.CHAT;

const emptyChatResponse = (): ChatResponse => ({
	ids: [],
	documents: [],
	metadatas: [],
	chatTurns: [],
	displayTurns: [],
});

export const chatStore = {
	// Cache for session collections
	_chatCollection: null as Collection | null,

	// Get collection methods with caching
	_getChatCollection: async (): Promise<Collection> => {
		if (chatStore._chatCollection) return chatStore._chatCollection;
		const collection = await getChatCollection();
		chatStore._chatCollection = collection;
		return collection;
	},

	// Store request (public for non-regen editing)
	_storeRequest: async (request: ChatMessage): Promise<ChatMessage> => {
		const { entries, ...requestMetadata } = request;
		const { sessionId, sequence, messageId } = requestMetadata;
		const now = new Date().toISOString();
		const updatedMetadata: ChatMessageMetadata = {
			...requestMetadata,
			messageId: messageId || buildMessageId(sessionId, sequence, 'request'),
			createdAt: request.createdAt || now,
			updatedAt: now,
			type: METADATA_TYPES.MESSAGE,
			model: 'none',
		};

		const collection = await chatStore._getChatCollection();
		try {
			const documentForEmbedding = flatChatMessageToDoc(request.entries);
			await upsertRecord(collection, updatedMetadata.messageId, documentForEmbedding, updatedMetadata);
			return { entries, ...updatedMetadata };
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
			model: model || 'none',
		};
		try {
			const collection = await chatStore._getChatCollection();

			const documentForEmbedding = flatChatMessageToDoc(response.entries);
			await upsertRecord(collection, updatedMetadata.messageId, documentForEmbedding, updatedMetadata);
			return { entries, ...updatedMetadata };
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [storeResponse].',
				`Failed to store response message for session ${sessionId}:`
			);
		}
	},
	/**
	 * @private
	 * Reconstructs rich ChatTurn objects from primary documents and their associated index records.
	 */
	_constructChatTurnIndexes: async (chatTurnIds: string[]): Promise<Metadata[]> => {
		const collection = await chatStore._getChatCollection();
		const rawIndexResults = await getRecords(collection, { chatTurnId: { $in: chatTurnIds } });
		const indexResults = validateChromaResponse(rawIndexResults, 'getList', collectionType);
		return indexResults.metadatas.filter((m) => !!m);
	},

	/**
	 * @private
	 * Reconstructs rich ChatTurn objects from primary documents and their associated index records.
	 */
	_constructFullChatTurns(
		turnMetadatas: (Metadata | null)[],
		allIndexRecords: (Metadata | null)[]
	): ChatTurn[] {
		return (turnMetadatas as unknown as ChatTurnMetadata[]).map((metadata) => {
			// Find all index records that belong to chatStore specific turn
			const relatedIndexRecords = (allIndexRecords as unknown as ChatIndexMetadata[]).filter(
				(record) => record.chatTurnId === metadata.chatTurnId
			);
			// Use the utility to "inflate" the rich object
			return metadataToChatTurn(metadata, relatedIndexRecords);
		});
	},

	/**
	 * @private
	 * Reconstructs rich ChatTurn objects from primary documents and their associated index records.
	 */
	_constructDisplayChatTurns(turnMetadatas: (Metadata | null)[]): DisplayTurn[] {
		return (turnMetadatas as unknown as ChatTurnMetadata[]).map((metadata) => {
			// Find all index records that belong to chatStore specific turn
			// Use the utility to "inflate" the rich object
			return metadataToDisplayTurn(metadata);
		});
	},
	/**
	 * @private
	 * Creates or updates the denormalized search index records for a given ChatTurn.
	 */
	_updateSearchIndexForTurn: async (turn: ChatTurn): Promise<void> => {
		const collection = await chatStore._getChatCollection();

		// --- 1. CRITICAL FIX: Atomically delete all EXISTING INDEX entries for this turn ---
		const oldIndexWhere: Where = {
			$and: [{ type: { $eq: METADATA_TYPES.INDEX } }, { chatTurnId: { $eq: turn.chatTurnId } }],
		};
		await collection.delete({ where: oldIndexWhere });

		// --- 2. Create new index records with UNIQUE IDs and document content ---
		const newIndexRecords: { id: string; document: string; metadata: ChatIndexMetadata }[] = [];
		const baseMetadata = {
			type: METADATA_TYPES.INDEX, // Use a dedicated type for indexes
			chatTurnId: turn.chatTurnId,
			sessionId: turn.sessionId,
			characterId: turn.characterId,
			originalCreatedAt: turn.createdAt,
		};

		const createIndexRecords = (list: string[], contentType: ChatIndexContentType) => {
			if (!list || list.length === 0) return;
			for (const value of list) {
				if (!value || value.trim() === '') continue;
				newIndexRecords.push({
					// --- CRITICAL FIX: Ensure ID is unique by including the value ---
					id: buildChatTurnIndexId(turn.chatTurnId, contentType),
					document: value, // The value itself is the content to be embedded
					metadata: { ...baseMetadata, contentType, value },
				});
			}
		};

		// Create index records for all filterable attributes
		createIndexRecords(turn.keywordList, 'KEYWORD');
		createIndexRecords(turn.topicList, 'TOPIC');
		createIndexRecords(turn.entityList, 'ENTITY');
		createIndexRecords(turn.actionList, 'ACTION');
		createIndexRecords(turn.flagList, 'FLAG');
		createIndexRecords(turn.relationshipShiftList, 'RELATIONSHIP_SHIFT');
		createIndexRecords(turn.userEmotion.nuanceList, 'USER_EMOTION_NUANCE');
		createIndexRecords(turn.characterEmotion.nuanceList, 'CHARACTER_EMOTION_NUANCE');

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
	 * Stores a fully enriched chat turn and updates its search index.
	 * This is the single, authoritative method for saving a finalized turn.
	 */
	storeChatTurn: async (turn: ChatTurn): Promise<void> => {
		try {
			const collection = await chatStore._getChatCollection();

			// 1. Prepare and store the primary TURN document
			const metadata = chatTurnToMetadata(turn);
			const document = chatTurnToDocument(turn);
			await upsertRecords(collection, [metadata.chatTurnId], [document], [metadata]);

			// 2. Update the denormalized search index for this turn
			await chatStore._updateSearchIndexForTurn(turn);
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while doing [storeChatTurn].',
				`Failed to store chat turn ${turn.chatTurnId}`
			);
		}
	},

	/**
	 * [Optimized for Client] Fetches a lean list of chat turns for UI display.
	 */
	getAllDisplayTurns: async (sessionId: string): Promise<ChatResponse> => {
		try {
			const collection = await chatStore._getChatCollection();
			const where: Where = {
				$and: [{ type: { $eq: METADATA_TYPES.TURN } }, { sessionId: { $eq: sessionId } }],
			};
			const results = await getRecords(collection, where);
			const validatedResults = validateChromaResponse(results, 'getList', collectionType);
			const displayTurns = validatedResults.metadatas.map((metadata) =>
				metadataToDisplayTurn(metadata as unknown as ChatTurnMetadata)
			);
			return { ...validatedResults, displayTurns, chatTurns: [] };
		} catch (error) {
			handleServiceError(error, `Failed to get display history for session ${sessionId}`);
		}
	},

	/**
	 * [For Backend RAG] Fetches full, rich ChatTurn objects for a session.
	 */
	getAllChatTurns: async (sessionId: string): Promise<ChatResponse> => {
		try {
			const collection = await chatStore._getChatCollection();

			// 1. Fetch primary TURN documents
			const turnResults = await getRecords(collection, {
				$and: [{ type: { $eq: METADATA_TYPES.TURN } }, { sessionId: { $eq: sessionId } }],
			});
			const primaryTurnDocs = validateChromaResponse(turnResults, 'getList', collectionType);
			if (primaryTurnDocs.ids.length === 0) return emptyChatResponse();

			// 2. Fetch all associated search index records
			const turnIds = primaryTurnDocs.ids;
			const indexWhere: Where = {
				$and: [{ type: { $eq: METADATA_TYPES.INDEX } }, { chatTurnId: { $in: turnIds } }],
			};
			const indexResults = await getRecords(collection, indexWhere);
			const allIndexRecords = validateChromaResponse(indexResults, 'getList', collectionType);

			// 3. Reconstruct the full, rich objects
			const chatTurns = primaryTurnDocs.metadatas.map((metadata) => {
				const relatedIndexRecords = allIndexRecords.metadatas.filter(
					(record) =>
						!!record && record.chatTurnId === (metadata as unknown as ChatTurnMetadata).chatTurnId
				);
				return metadataToChatTurn(
					metadata as unknown as ChatTurnMetadata,
					relatedIndexRecords as unknown as ChatIndexMetadata[]
				);
			});

			return { ...primaryTurnDocs, chatTurns, displayTurns: [] };
		} catch (error) {
			handleServiceError(error, 'Error in getAllChatTurns', `Session: ${sessionId}`);
		}
	},
	/**
	 * Stores multiple chat turns in a single bulk operation.
	 * Ideal for data migration or batch processing.
	 * @param chatTurns An array of ChatTurn objects to store.
	 */
	storeChatTurns: async (chatTurns: ChatTurn[]): Promise<void> => {
		if (!chatTurns || chatTurns.length === 0) {
			return;
		}

		const collection = await chatStore._getChatCollection();

		const recordsToUpsert = chatTurns.map((turn) => {
			const metadata = chatTurnToMetadata(turn);
			const document = chatTurnToDocument(turn);
			return { id: metadata.chatTurnId, document, metadata };
		});

		try {
			await upsertRecords(
				collection,
				recordsToUpsert.map((r) => r.id),
				recordsToUpsert.map((r) => r.document),
				recordsToUpsert.map((r) => r.metadata)
			);
			console.log(`[chatStore] Successfully stored ${chatTurns.length} chat turns in bulk.`);
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while doing [storeChatTurns].',
				`Failed to bulk store ${chatTurns.length} chat turns.`
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
			const collection = await chatStore._getChatCollection();

			const conditions: Where[] = [
				{ sessionId: { $eq: sessionId } },
				{ type: { $eq: METADATA_TYPES.MESSAGE } },
				{ messageType: { $eq: messageType } },
			];
			if (where && isAndWhere(where)) {
				conditions.push(...where.$and);
			}
			const whereClause: Where = { $and: conditions };

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
			let turnIdsToFetch: string[] = [];
			const collection = await chatStore._getChatCollection();
			// Step 1: Pre-filter based on metadata to get relevant turn IDs
			if (where && Object.keys(where).length > 0) {
				const indexResults = await getRecords(collection, where);
				const validatedIndexes = validateChromaResponse(indexResults, 'getList', collectionType);
				turnIdsToFetch = [
					...new Set(
						validatedIndexes.metadatas.map((m) => (m as unknown as ChatIndexMetadata).chatTurnId)
					),
				];

				if (turnIdsToFetch.length === 0) {
					return emptyChatResponse();
				}
			}

			// Step 2: Perform semantic search on the pre-filtered set
			// CORRECTED: Programmatically build the conditions to avoid TypeScript errors.
			const conditions: Where[] = [
				{ type: { $eq: METADATA_TYPES.TURN } },
				{ sessionId: { $eq: sessionId } },
			];
			if (turnIdsToFetch) {
				conditions.push({ chatTurnId: { $in: turnIdsToFetch } });
			}
			const queryWhere: Where = { $and: conditions };

			const queryResults = await queryRecords(
				collection,
				queryTexts,
				queryWhere,
				whereDocument,
				limit
			);
			const result = queryResults.map((r) => validateChromaResponse(r, 'getList', collectionType));
			const turnIds = result.flatMap((r) => r.ids);
			const turnMetadatas = result.flatMap((r) => r.metadatas);
			const turnDocuments = result.flatMap((r) => r.documents);
			// Collect all results
			if (turnMetadatas.length === 0) {
				return emptyChatResponse();
			}

			// Step 3: Fetch all index records for the final set of turns
			const chatTurnIds: string[] = turnMetadatas
				.map((m) => m?.chatTurnId)
				.filter((id): id is string => typeof id === 'string');

			const indexMetadatas = await chatStore._constructChatTurnIndexes(chatTurnIds);

			// Step 4: Reconstruct the full rich objects
			const chatTurns = chatStore._constructFullChatTurns(turnMetadatas, indexMetadatas);
			return {
				ids: turnIds,
				metadatas: turnMetadatas,
				documents: turnDocuments,
				chatTurns,
				displayTurns: [],
			};
		} catch (error) {
			console.error(`Failed to query chat log for session ${sessionId}:`, error);
			return emptyChatResponse();
		}
	},

	/** Loads multiple FIXED turns  */
	getDisplayTurnsBeforeSequence: async (
		sessionId: string,
		beforeSequence: number
	): Promise<ChatResponse> => {
		const collection = await chatStore._getChatCollection();
		const where: Where = {
			$and: [
				{ type: { $eq: METADATA_TYPES.TURN } },
				{ sessionId: { $eq: sessionId } },
				{ sequence: { $lt: beforeSequence } },
			],
		};
		try {
			const rawResults = await getRecords(collection, where);
			const results = validateChromaResponse(rawResults, 'getList', collectionType);
			const displayTurns = chatStore._constructDisplayChatTurns(results.metadatas);

			return { ...results, chatTurns: [], displayTurns };
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [getLoadingChatTurns].',
				`Failed to load chat turns for session ${sessionId}:`
			);
		}
	},

	/** Gets a single FIXED turn by sequence */
	getChatTurnBySequence: async (sessionId: string, sequence: number): Promise<ChatTurn> => {
		const collection = await chatStore._getChatCollection();
		const turnId = buildChatTurnId(sessionId, sequence);
		try {
			const rawResult = await getRecordById(collection, turnId);
			const results = validateChromaResponse(rawResult, 'getOne', collectionType);
			const indexMetadatas = await chatStore._constructChatTurnIndexes([results.ids[0]]);
			return chatStore._constructFullChatTurns(results.metadatas, indexMetadatas)[0];
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [getChatTurnBySequence].',
				`Failed to get chat turn by sequence for session ${sessionId}:`
			);
		}
	},

	_deleteChatTurn: async (chatTurnId: string): Promise<void> => {
		const collection = await chatStore._getChatCollection();
		await deleteRecordById(collection, chatTurnId);
	},

	// Method to clear the cache if needed (e.g., for testing or memory management)
	clearChatCollectionCache: (): void => {
		chatStore._chatCollection = null;
	},
};
