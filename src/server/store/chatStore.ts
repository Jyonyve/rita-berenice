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
import { flatChatMessageToDoc, chatTurnToDocument } from '#server/util/documentUtils.js';
import { ApiError } from '#shared/domain/error/errors.js';
import { handleServiceError, validateChromaResponse } from '../util/serviceHelpers.js';
import {
	chatTurnToMetadata,
	metadataToChatTurn,
	metadataToDisplayTurn,
} from '#shared/util/dbConvertUtils.js';
import { ChatResponse } from '#shared/api/ModuleResponse.js';
import {
	buildChatTurnIndexId,
	buildChatTurnId,
	buildMessageId,
} from '#shared/util/buildIdUtils.js';
import { FilterCriteria } from '../util/schemaUtils.js';
import { MEMORY_CONFIG, prioritizeRecentTurns } from '../util/queryUtils.js';

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
	 * @private
	 * Dynamically builds a ChromaDB 'where' clause to filter INDEX documents.
	 */
	_buildIndexWhereClause(sessionId: string, criteria: FilterCriteria): Where | undefined {
		const orConditions: Where[] = [];

		const addConditions = (list: string[] | undefined, type: ChatIndexContentType) => {
			if (!list || list.length === 0) return;
			list.forEach((item) => {
				orConditions.push({
					$and: [
						{ type: { $eq: METADATA_TYPES.INDEX } },
						{ contentType: { $eq: type } },
						{ value: { $eq: item } },
					],
				});
			});
		};

		// Map criteria to index content types
		addConditions(criteria.topics, 'TOPIC');
		addConditions(criteria.keywords, 'KEYWORD');
		addConditions(criteria.entities?.characters, 'ENTITY'); // Assuming characters are stored as 'ENTITY' type
		addConditions(criteria.entities?.locations, 'ENTITY'); // And locations too

		if (criteria.emotion) {
			addConditions([criteria.emotion], 'USER_EMOTION_NUANCE');
			addConditions([criteria.emotion], 'CHARACTER_EMOTION_NUANCE');
		}

		if (orConditions.length === 0) {
			return undefined;
		}

		// The final clause should find any INDEX doc for the session that matches ANY of the criteria.
		return { $and: [{ sessionId: { $eq: sessionId } }, { $or: orConditions }] };
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
	 * [OPTIMIZED] Fetches a single, full ChatTurn object by its ID.
	 * This retrieves the primary turn document and all its associated index records.
	 * @param chatTurnId - The unique ID of the chat turn to fetch.
	 * @returns A ChatResponse containing the single, fully reconstructed ChatTurn.
	 */
	getChatTurn: async (chatTurnId: string): Promise<ChatResponse> => {
		try {
			const collection = await chatStore._getChatCollection();

			// 1. Fetch the primary turn document and all its index records in one go.
			const turnAndIndexDocsResponse = await getRecords(collection, {
				chatTurnId: { $eq: chatTurnId },
			});

			const allDocs = validateChromaResponse(turnAndIndexDocsResponse, 'getList', collectionType);
			if (allDocs.ids.length === 0) {
				throw new ApiError(404, `Chat turn with ID '${chatTurnId}' not found.`);
			}

			// 2. Partition the results into the primary turn and its index records.
			let primaryTurnDoc: { id: string; document: string | null; metadata: Metadata | null } | null =
				null;
			const indexRecords: Metadata[] = [];

			// Use a standard 'for' loop to avoid closure-related type inference issues.
			for (let i = 0; i < allDocs.metadatas.length; i++) {
				const metadata = allDocs.metadatas[i];
				if (metadata) {
					if (metadata.type === METADATA_TYPES.TURN) {
						primaryTurnDoc = { id: allDocs.ids[i], document: allDocs.documents[i], metadata: metadata };
					} else if (metadata.type === METADATA_TYPES.INDEX) {
						indexRecords.push(metadata);
					}
				}
			}

			// Ensure the primary turn document was actually found. This guard now works reliably.
			if (!primaryTurnDoc || !primaryTurnDoc.metadata) {
				throw new ApiError(404, `Primary turn data for ID '${chatTurnId}' is missing or corrupt.`);
			}

			// 3. Reconstruct the single full, rich object.
			const chatTurn = chatStore._constructFullChatTurns(
				[primaryTurnDoc.metadata], // Pass metadata as an array
				indexRecords
			)[0]; // Get the first (and only) element

			// 4. Return the complete ChatResponse object for the single turn.
			return {
				ids: [primaryTurnDoc.id],
				documents: [primaryTurnDoc.document],
				metadatas: [primaryTurnDoc.metadata],
				chatTurns: [chatTurn], // Return as an array
				displayTurns: [],
			};
		} catch (error) {
			handleServiceError(error, 'Error in getChatTurn', `ChatTurnID: ${chatTurnId}`);
		}
	},

	/**
	 * [OPTIMIZED for Deep Copy & RAG] Fetches full, rich ChatTurn objects for a session.
	 * This version uses a single, efficient query to avoid the N+1 problem.
	 * NOTE: it querys lots of data, db crashes at scale 1. if want to use this method upgrade db or give some limits.
	 */
	getAllChatTurns: async (sessionId: string): Promise<ChatResponse> => {
		try {
			const collection = await chatStore._getChatCollection();

			// 1. Fetch ALL documents (TURN and INDEX) for the session in ONE go.
			const allDocsResponse = await getRecords(collection, { sessionId: { $eq: sessionId } });

			const allDocs = validateChromaResponse(allDocsResponse, 'getList', collectionType);
			if (allDocs.ids.length === 0) return emptyChatResponse();

			// 2. Partition the results into primary turns and index records in memory (very fast).
			const primaryTurnDocs: {
				ids: string[];
				documents: (string | null)[];
				metadatas: (Metadata | null)[];
			} = { ids: [], documents: [], metadatas: [] };
			const allIndexRecords: Metadata[] = [];

			allDocs.metadatas.forEach((metadata, i) => {
				if (metadata) {
					if (metadata.type === METADATA_TYPES.TURN) {
						primaryTurnDocs.ids.push(allDocs.ids[i]);
						primaryTurnDocs.documents.push(allDocs.documents[i]);
						primaryTurnDocs.metadatas.push(metadata);
					} else if (metadata.type === METADATA_TYPES.INDEX) {
						allIndexRecords.push(metadata);
					}
				}
			});

			if (primaryTurnDocs.ids.length === 0) return emptyChatResponse();

			// 3. Reconstruct the full, rich objects using the partitioned data.
			const chatTurns = chatStore._constructFullChatTurns(primaryTurnDocs.metadatas, allIndexRecords);

			// Return the complete ChatResponse object.
			return {
				ids: primaryTurnDocs.ids,
				documents: primaryTurnDocs.documents,
				metadatas: primaryTurnDocs.metadatas,
				chatTurns,
				displayTurns: [],
			};
		} catch (error) {
			handleServiceError(error, 'Error in optimized getAllChatTurns', `Session: ${sessionId}`);
		}
	},

	// In src/server/store/chatStore.ts

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
			// Step 1: Store primary TURN documents
			await upsertRecords(
				collection,
				recordsToUpsert.map((r) => r.id),
				recordsToUpsert.map((r) => r.document),
				recordsToUpsert.map((r) => r.metadata)
			);
			console.log(`[chatStore] Successfully stored ${chatTurns.length} primary turns.`);

			// Step 2: Update the search index for EACH turn
			console.log(`[chatStore] Now updating indexes for ${chatTurns.length} turns...`);
			for (const turn of chatTurns) {
				await chatStore._updateSearchIndexForTurn(turn);
			}
			console.log(`[chatStore] Successfully updated all search indexes.`);
		} catch (error) {
			handleServiceError(
				error,
				'Error during bulk store and index',
				`Failed for ${chatTurns.length} turns.`
			);
		}
	},

	// Enhanced Query Operations
	// queryChatMessages: async (
	// 	sessionId: string,
	// 	queryTexts: string[],
	// 	messageType: ChatMessageType,
	// 	where?: Where,
	// 	whereDocumennt?: WhereDocument,
	// 	limit?: number
	// ): Promise<string[]> => {
	// 	try {
	// 		const collection = await chatStore._getChatCollection();

	// 		const conditions: Where[] = [
	// 			{ sessionId: { $eq: sessionId } },
	// 			{ type: { $eq: METADATA_TYPES.MESSAGE } },
	// 			{ messageType: { $eq: messageType } },
	// 		];
	// 		if (where && isAndWhere(where)) {
	// 			conditions.push(...where.$and);
	// 		}
	// 		const whereClause: Where = { $and: conditions };

	// 		const rawResults = await queryRecords(
	// 			collection,
	// 			queryTexts,
	// 			whereClause,
	// 			whereDocumennt,
	// 			limit
	// 		);
	// 		const results = rawResults.map((raw) => validateChromaResponse(raw, 'getList', collectionType));
	// 		return results.flatMap((result) => {
	// 			const chatMessages = result.documents
	// 				.flatMap((doc) => (typeof doc === 'string' ? parseTextToEntries(doc) : []))
	// 				.filter((msg) => msg !== null);

	// 			return chatMessages.map((msg) => JSON.stringify(msg));
	// 		});
	// 	} catch (error) {
	// 		console.error(`Failed to query chat log for session ${sessionId}:`, error);
	// 		return [];
	// 	}
	// },

	queryChatTurns: async (
		sessionId: string,
		queryTexts: string[],
		filterCriteria?: FilterCriteria,
		whereDocument?: WhereDocument,
		limit?: number
	): Promise<ChatResponse> => {
		try {
			let turnIdsToSearch: string[] | undefined = undefined;
			const collection = await chatStore._getChatCollection();

			// Step 1: Pre-filter based on metadata to get relevant turn IDs
			if (filterCriteria && Object.keys(filterCriteria).length > 0) {
				const indexWhereClause = chatStore._buildIndexWhereClause(sessionId, filterCriteria);

				if (indexWhereClause) {
					console.log('[chatStore] Querying INDEX docs with:', JSON.stringify(indexWhereClause));
					const indexResults = await getRecords(collection, indexWhereClause);
					const validatedIndexes = validateChromaResponse(indexResults, 'getList', collectionType);

					const matchingTurnIds = [
						...new Set(
							validatedIndexes.metadatas.map((m) => (m as unknown as ChatIndexMetadata)?.chatTurnId)
						),
					];

					if (matchingTurnIds.length === 0) {
						console.log('[chatStore] No turns found matching metadata filter. Returning empty.');
						return emptyChatResponse();
					}

					// **NEW: Apply smart limiting to pre-filtered results**
					if (matchingTurnIds.length > MEMORY_CONFIG.MAX_PREFILTER_TURNS) {
						turnIdsToSearch = prioritizeRecentTurns(matchingTurnIds, MEMORY_CONFIG.MAX_PREFILTER_TURNS);
						console.log(
							`[chatStore] Reduced from ${matchingTurnIds.length} to ${turnIdsToSearch.length} turns using recency bias.`
						);
					} else {
						turnIdsToSearch = matchingTurnIds;
					}

					console.log(`[chatStore] Pre-filtered to ${turnIdsToSearch.length} turns.`);
				}
			}

			// Step 2: Perform vector search on TURN documents (rest remains the same)
			const queryWhere: Where = {
				$and: [{ type: { $eq: METADATA_TYPES.TURN } }, { sessionId: { $eq: sessionId } }],
			};

			if (turnIdsToSearch) {
				queryWhere.$and?.push({ chatTurnId: { $in: turnIdsToSearch } });
			}

			console.log('[chatStore] Querying TURN docs with:', JSON.stringify(queryWhere));
			const queryResults = await queryRecords(
				collection,
				queryTexts,
				queryWhere,
				whereDocument,
				limit
			);

			// Rest of the method remains the same...
			const result = queryResults.map((r) => validateChromaResponse(r, 'getList', collectionType));
			const turnIds = result.flatMap((r) => r.ids);
			const turnMetadatas = result.flatMap((r) => r.metadatas);
			const turnDocuments = result.flatMap((r) => r.documents);

			if (turnMetadatas.length === 0) {
				return emptyChatResponse();
			}

			const chatTurnIds: string[] = turnMetadatas
				.map((m) => m?.chatTurnId)
				.filter((id): id is string => typeof id === 'string');

			const indexMetadatas = await chatStore._constructChatTurnIndexes(chatTurnIds);
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
	getChatTurnBySequence: async (sessionId: string, sequence: number): Promise<ChatResponse> => {
		const collection = await chatStore._getChatCollection();
		const turnId = buildChatTurnId(sessionId, sequence);
		try {
			const rawResult = await getRecordById(collection, turnId);
			const results = validateChromaResponse(rawResult, 'getOne', collectionType);
			const indexMetadatas = await chatStore._constructChatTurnIndexes(results.ids);
			const chatTurns = chatStore._constructFullChatTurns(results.metadatas, indexMetadatas);

			return { ...results, chatTurns, displayTurns: [] };
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [getChatTurnBySequence].',
				`Failed to get chat turn by sequence for session ${sessionId}:`
			);
		}
	},

	/**
	 * Deletes a chat turn and all of its associated index records atomically.
	 * This prevents orphaned index data.
	 * @param chatTurnId The ID of the primary chat turn document to delete.
	 */
	_deleteChatTurn: async (chatTurnId: string): Promise<void> => {
		try {
			const collection = await chatStore._getChatCollection();

			// --- Step 1: Delete all associated index records ---
			// We target records that are of type INDEX and have a matching chatTurnId.
			const indexWhere: Where = {
				$and: [{ type: { $eq: METADATA_TYPES.INDEX } }, { chatTurnId: { $eq: chatTurnId } }],
			};

			// Use the plural `delete` method with a 'where' clause.
			await deleteRecords(collection, undefined, indexWhere);
			console.log(`[chatStore] Deleted index records for turn: ${chatTurnId}`);

			// --- Step 2: Delete the primary chat turn document ---
			// Now it's safe to delete the main document itself.
			await deleteRecordById(collection, chatTurnId);
			console.log(`[chatStore] Deleted primary turn document: ${chatTurnId}`);
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred during [deleteChatTurn].',
				`Failed to completely delete chat turn ${chatTurnId}`
			);
		}
	},

	// Method to clear the cache if needed (e.g., for testing or memory management)
	clearChatCollectionCache: (): void => {
		chatStore._chatCollection = null;
	},
};
