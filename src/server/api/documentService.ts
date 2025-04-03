import type {
	ChatTurn,
	ChatMessage,
	ChatEntry,
	ChatRoleType,
	ChatMessageType,
} from '#root/src/client/domain/chat';
import { AiRole, SUFFIX } from '#root/src/client/domain/index';
import { parseEntriesToText, buildMessageId, buildTurnId, buildSummaryId } from '#root/src/shared';
import chromaCollection from '../chromadb/chromaCollections';
import { Collection, IncludeEnum } from 'chromadb';

const DEFAULT_QUERY_LIMIT = Number(process.env.VITE_QUERY_LIMIT) || 10;

// Destructure outside the object
const { getSessionCollection, addDocument, upsertDocument, getDocumentById, queryDocuments } =
	chromaCollection;

export const documentService = {
	// Cache for session collections
	_sessionCollections: new Map<string, Collection>(),

	// Get collection with caching (more efficient)
	_getCollection: async (sessionId: string): Promise<Collection> => {
		// First check if it's in the cache (non-async operation)
		const cachedCollection = documentService._sessionCollections.get(sessionId);
		if (cachedCollection) {
			return cachedCollection;
		}

		// If not in cache, fetch it (async operation)
		const collection = await getSessionCollection(sessionId);
		documentService._sessionCollections.set(sessionId, collection);
		return collection;
	},

	_storeFullChatTurnString: async (sessionId: string, chatTurn: ChatTurn): Promise<void> => {
		const collection = await documentService._getCollection(sessionId);
		const turnId = buildTurnId(sessionId, chatTurn.sequence);
		await addDocument(collection, turnId, JSON.stringify(chatTurn), {
			type: 'full_turn',
			sessionId: chatTurn.sessionId,
			sequence: chatTurn.sequence,
			timestamp: chatTurn.request.timestamp,
			isFixed: true,
		});
	},

	// Remove temporary turns for a given sequence
	_removeTemporaryTurns: async (sessionId: string, sequence: number): Promise<void> => {
		const collection = await documentService._getCollection(sessionId);
		try {
			// Find all documents for this sequence that are not fixed
			const results = await collection.get({ where: { sessionId, sequence, isFixed: false } });

			// If any temporary documents found, delete them
			if (results.ids && results.ids.length > 0) {
				await collection.delete({ ids: results.ids });
				console.log(
					`Removed ${results.ids.length} temporary documents for session ${sessionId}, sequence ${sequence}`
				);
			}
		} catch (error) {
			console.error(
				`Failed to remove temporary turns for session ${sessionId}, sequence ${sequence}:`,
				error
			);
		}
	},

	// Chat Turn Operations - Enhanced for better AI retrieval
	storeChatTurn: async (sessionId: string, chatTurn: ChatTurn): Promise<void> => {
		const collection = await documentService._getCollection(sessionId);

		// If this is a fixed turn, remove any temporary turns with the same sequence
		if (chatTurn.isFixed) {
			await documentService._removeTemporaryTurns(sessionId, chatTurn.sequence);
		}

		// Store request
		const requestContent = parseEntriesToText(chatTurn.request.entries);
		const requestId = buildMessageId(sessionId, chatTurn.sequence, 'request');
		await addDocument(collection, requestId, requestContent, {
			type: 'message',
			messageType: SUFFIX.REQUEST,
			sessionId: chatTurn.sessionId,
			sequence: chatTurn.sequence,
			role: chatTurn.request.role,
			timestamp: chatTurn.request.timestamp,
			isFixed: chatTurn.isFixed,
		});

		// Store each response
		for (let i = 0; i < chatTurn.response.length; i++) {
			const response = chatTurn.response[i];
			const responseContent = parseEntriesToText(response.entries);
			const responseId = buildMessageId(sessionId, chatTurn.sequence, 'response', i);

			await addDocument(collection, responseId, responseContent, {
				type: 'message',
				messageType: SUFFIX.RESPONSE,
				sessionId: chatTurn.sessionId,
				sequence: chatTurn.sequence,
				role: response.role,
				timestamp: response.timestamp,
				isFixed: chatTurn.isFixed,
				responseIndex: i,
			});
		}

		// Store the full turn as JSON only when it's fixed
		if (chatTurn.isFixed) {
			await documentService._storeFullChatTurnString(sessionId, chatTurn);
			await documentService._removeTemporaryTurns(sessionId, chatTurn.sequence);
		}
	},

	// Summary Operations
	storeSummary: async (sessionId: string, newSummary: string): Promise<void> => {
		const collection = await documentService._getCollection(sessionId);
		const summaryId = buildSummaryId(sessionId);
		const existingSummary = await documentService.getSummary(sessionId);

		const updatedSummary = existingSummary ? `${existingSummary}\n---\n${newSummary}` : newSummary;

		// Get existing metadata to extract updateCount
		let updateCount = 0;
		try {
			const existingMetadata = await collection.get({
				ids: [summaryId],
				include: [IncludeEnum.Metadatas],
			});

			// Safely access the updateCount with null checks
			if (
				existingMetadata.metadatas &&
				existingMetadata.metadatas.length > 0 &&
				existingMetadata.metadatas[0] !== null
			) {
				const count = existingMetadata.metadatas[0].updateCount;
				// Ensure we're dealing with a number
				updateCount = typeof count === 'number' ? count + 1 : 1;
			}
		} catch (error) {
			// If there's an error, just use 0 as the default
			updateCount = 0;
		}

		await upsertDocument(collection, summaryId, updatedSummary, {
			type: 'summary',
			sessionId,
			timestamp: new Date().toISOString(),
			updateCount,
		});
	},

	getSummary: async (sessionId: string): Promise<string> => {
		const collection = await documentService._getCollection(sessionId);
		const summaryId = buildSummaryId(sessionId);

		try {
			const summary = await getDocumentById(collection, summaryId);
			return summary || '';
		} catch (error) {
			console.warn(`No summary found for session ${sessionId}`);
			return '';
		}
	},

	// Enhanced Query Operations
	queryChatLog: async (
		sessionId: string,
		queryText: string,
		messageTypes: ChatMessageType[],
		fixedOnly: boolean = true,
		limit?: number
	): Promise<string[]> => {
		const collection = await documentService._getCollection(sessionId);

		try {
			// Create a where clause that includes the specified message types
			// and optionally filters for fixed messages only
			const whereClause: Record<string, any> = { type: 'message', messageType: { $in: messageTypes } };

			if (fixedOnly) {
				whereClause.isFixed = true;
			}

			return await queryDocuments(collection, queryText, whereClause, limit ?? -1);
		} catch (error) {
			console.error(`Failed to query chat log for session ${sessionId}:`, error);
			return [];
		}
	},

	// Infinite scroll
	getRecentChatLogs: async (
		sessionId: string,
		turnCount: number = 5,
		fixedOnly: boolean = false,
		beforeSequence?: number
	): Promise<ChatTurn[]> => {
		// Get collection from cache synchronously if possible
		const cachedCollection = documentService._sessionCollections.get(sessionId);
		const collection = cachedCollection || (await getSessionCollection(sessionId));

		if (!cachedCollection) {
			documentService._sessionCollections.set(sessionId, collection);
		}

		try {
			const whereClause: Record<string, any> = { type: 'full_turn', sessionId };

			if (fixedOnly) {
				whereClause.isFixed = true;
			}

			if (beforeSequence !== undefined) {
				whereClause.sequence = { $lt: beforeSequence };
			}

			// Use limit parameter directly in the query
			const results = await collection.get({
				where: whereClause,
				include: [IncludeEnum.Documents],
				limit: turnCount,
				// You can also use offset if needed for pagination
				// offset: offsetValue
			});

			if (!results.documents || results.documents.length === 0) {
				return [];
			}

			// Handle the null check in the map function
			const turns = results.documents
				.map((doc) => {
					if (doc === null) return null;
					try {
						return JSON.parse(doc) as ChatTurn;
					} catch (e) {
						console.error('Error parsing chat turn:', e);
						return null;
					}
				})
				.filter((turn): turn is ChatTurn => turn !== null);

			// Sort by sequence number (descending)
			turns.sort((a, b) => b.sequence - a.sequence);

			return turns;
		} catch (error) {
			console.error(`Failed to get recent chat logs for session ${sessionId}:`, error);
			return [];
		}
	},

	querySummary: async (sessionId: string, queryText: string): Promise<string[]> => {
		const collection = await documentService._getCollection(sessionId);
		const summaryId = buildSummaryId(sessionId);

		try {
			const summary = await documentService.getSummary(sessionId);
			if (!summary) return [];

			return await queryDocuments(collection, queryText, { id: summaryId, type: 'summary' }, 1);
		} catch (error) {
			console.warn(`Failed to query summary for session ${sessionId}:`, error);
			return [];
		}
	},

	// Get full chat turn by sequence number
	getChatTurnBySequence: async (
		sessionId: string,
		sequence: number,
		fixedOnly: boolean = true
	): Promise<ChatTurn | null> => {
		const collection = await documentService._getCollection(sessionId);
		const turnId = buildTurnId(sessionId, sequence);

		try {
			// If we only want fixed turns, check if this turn is fixed
			if (fixedOnly) {
				const metadata = await collection.get({ ids: [turnId], include: [IncludeEnum.Metadatas] });

				// Add null checks for type safety
				if (
					!metadata.metadatas ||
					metadata.metadatas.length === 0 ||
					metadata.metadatas[0] === null ||
					!metadata.metadatas[0].isFixed
				) {
					return null; // Not a fixed turn, return null
				}
			}

			const turnJson = await getDocumentById(collection, turnId);
			if (!turnJson) return null;

			return JSON.parse(turnJson) as ChatTurn;
		} catch (error) {
			console.error(`Failed to get chat turn ${sequence} for session ${sessionId}:`, error);
			return null;
		}
	},

	// Get all responses for a specific sequence
	getAllResponsesForSequence: async (
		sessionId: string,
		sequence: number,
		fixedOnly: boolean = false
	): Promise<ChatMessage[]> => {
		const collection = await documentService._getCollection(sessionId);

		try {
			// Create a where clause to find all responses for this sequence
			const whereClause: Record<string, any> = {
				type: 'message',
				messageType: SUFFIX.RESPONSE,
				sessionId,
				sequence,
			};

			if (fixedOnly) {
				whereClause.isFixed = true;
			}

			// Get all matching response documents
			const results = await collection.get({
				where: whereClause,
				include: [IncludeEnum.Documents, IncludeEnum.Metadatas],
			});

			if (!results.documents || !results.metadatas || results.documents.length === 0) {
				return [];
			}

			// Create pairs of documents and metadata, filtering out nulls
			const validPairs = results.documents
				.map((doc, index) => ({
					document: doc || '',
					metadata: results.metadatas?.[index] || {},
					originalIndex: index, // Keep track of original index for sorting later
				}))
				.filter((pair) => pair.document !== null && pair.metadata !== null);

			// Process each valid pair into a ChatMessage
			const responses = validPairs
				.map(({ document, metadata, originalIndex }) => {
					try {
						// For full JSON responses
						if (metadata.format === 'json') {
							const parsedResponse = JSON.parse(document);
							// Check if the parsed response is a valid ChatMessage
							if (parsedResponse && typeof parsedResponse === 'object') {
								return parsedResponse as ChatMessage;
							}
							return null;
						} else {
							// For text-only responses, reconstruct a basic ChatMessage
							return {
								role: metadata.role as ChatRoleType,
								messageId: buildMessageId(sessionId, sequence, SUFFIX.RESPONSE, originalIndex),
								speaker: metadata.speaker,
								entries: [{ type: 'dialogue', prompt: document }],
								timestamp: metadata.timestamp || new Date().toISOString(),
								// Store the responseIndex for sorting
								_responseIndex:
									typeof metadata.responseIndex === 'number' ? metadata.responseIndex : originalIndex,
							};
						}
					} catch (e) {
						console.error('Error parsing response:', e);
						return null;
					}
				})
				.filter((response): response is ChatMessage => response !== null);

			// Sort by responseIndex if available, otherwise by timestamp
			responses.sort((a, b) => {
				// First try to sort by _responseIndex if available
				if ('_responseIndex' in a && '_responseIndex' in b) {
					const indexA = (a as any)._responseIndex;
					const indexB = (b as any)._responseIndex;
					if (typeof indexA === 'number' && typeof indexB === 'number') {
						return indexA - indexB;
					}
				}

				// Fall back to sorting by timestamp
				const timeA = new Date(a.timestamp).getTime();
				const timeB = new Date(b.timestamp).getTime();
				return timeA - timeB;
			});

			// Remove the temporary _responseIndex property we added for sorting
			responses.forEach((response) => {
				if ('_responseIndex' in response) {
					delete (response as any)._responseIndex;
				}
			});

			return responses;
		} catch (error) {
			console.error(`Failed to get responses for session ${sessionId}, sequence ${sequence}:`, error);
			return [];
		}
	},

	buildUserPromptFromLog: async (
		sessionId: string,
		userText: string,
		isFullLogQuery: boolean = false,
		fixedOnly: boolean = true
	): Promise<string> => {
		if (!sessionId) throw new Error('No active session.');

		// Try summary first unless full log is requested
		let relevantDetail: string[] = [];
		if (!isFullLogQuery) {
			relevantDetail = await documentService.querySummary(sessionId, userText);
		}

		// Fall back to full chat log if needed
		if (!relevantDetail.length || isFullLogQuery) {
			// Query both request and response messages for comprehensive context
			relevantDetail = await documentService.queryChatLog(
				sessionId,
				userText,
				['request', 'response'],
				fixedOnly,
				DEFAULT_QUERY_LIMIT
			);
		}

		return relevantDetail.length
			? `Context:\n${relevantDetail.join('\n')}\nUser Prompt: ${userText}`
			: userText;
	},

	// Method to clear the cache if needed (e.g., for testing or memory management)
	clearCollectionCache: (sessionId?: string): void => {
		if (sessionId) {
			documentService._sessionCollections.delete(sessionId);
		} else {
			documentService._sessionCollections.clear();
		}
	},
};
