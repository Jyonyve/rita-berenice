import type {
	ChatTurn,
	ChatMessage,
	ChatRoleType,
	ChatMessageType,
	AiModelInfo,
} from '#root/src/shared/domain/index.ts';
import {
	parseEntriesToText,
	buildMessageId,
	buildTurnId,
	buildSummaryId,
	DEFAULT_QUERY_LIMIT,
	SUFFIX,
	DEFAULT_LOAING_CHAT_TURN_COUNT,
	DEFAULT_RECAP_INTERVAL,
	buildChatTurnToJsonString,
	DEFAULT_RECAP_MODEL_FREE,
	buildRecapId,
} from '#root/src/shared/index.ts';
import { Collection, IncludeEnum } from 'chromadb';
import { chromaDbClient } from '#server/db/chromaDbClient.ts';
import { llmService } from './llmService.ts';

// Destructure outside the object
const { getSessionCollection, addDocument, upsertDocument, getDocumentById, queryDocuments } =
	chromaDbClient;

export const chatService = {
	// Cache for session collections
	_sessionCollections: new Map<string, Collection>(),

	// Get collection with caching (more efficient)
	_getCollection: async (sessionId: string): Promise<Collection> => {
		// First check if it's in the cache (non-async operation)
		const cachedCollection = chatService._sessionCollections.get(sessionId);
		if (cachedCollection) {
			return cachedCollection;
		}

		// If not in cache, fetch it (async operation)
		const collection = await getSessionCollection(sessionId);
		chatService._sessionCollections.set(sessionId, collection);
		return collection;
	},

	_storeFullChatTurnString: async (sessionId: string, chatTurn: ChatTurn): Promise<void> => {
		const collection = await chatService._getCollection(sessionId);
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
		const collection = await chatService._getCollection(sessionId);
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

	_triggerRecapGeneration: async (sessionId: string, sequence: number): Promise<void> => {
		// 1. Fetch recent turns from DB
		const turnsForRecap = await chatService.getRecentTurns(sessionId, DEFAULT_RECAP_INTERVAL);
		if (turnsForRecap.length === 0) {
			console.warn(`No turns found for recap generation (Session: ${sessionId}, Seq: ${sequence})`);
			return;
		}

		// 2. Format prompt
		const recapPromptContent = `Create a concise recap of the key points from the following recent chat turns:\n${turnsForRecap
			.map((turn) => buildChatTurnToJsonString(turn)) // Ensure util is available
			.join('\n\n')}`;

		// 3. Get Recap Model Info (use default or allow configuration later)
		const recapModelInfo: AiModelInfo = DEFAULT_RECAP_MODEL_FREE; // Use keyless default shared constant

		// 4. Invoke LLM via llmService
		const recapContent = await llmService.invokeLlm('system', recapPromptContent, recapModelInfo); // Use invokeLlm

		if (!recapContent || recapContent.startsWith('[Error')) {
			console.warn(`Recap generation for sequence ${sequence} returned empty/error.`);
			return;
		}

		// 5. Save the Recap
		await chatService.storeRecap(sessionId, sequence, recapContent);
		console.log(
			`Successfully generated and saved recap for sequence No ${sequence}, session ${sessionId}.`
		);
	},

	// Chat Turn Operations - Enhanced for better AI retrieval
	storeChatTurn: async (chatTurn: ChatTurn): Promise<void> => {
		// validation
		if (!chatTurn || typeof chatTurn.sequence !== 'number' || !chatTurn.sessionId) {
			throw new Error('Invalid ChatTurn data received.');
		}
		const sessionId = chatTurn.sessionId;
		const collection = await chatService._getCollection(sessionId);

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
			await chatService._storeFullChatTurnString(sessionId, chatTurn);
			await chatService._removeTemporaryTurns(sessionId, chatTurn.sequence);
		}
	},

	storeRecap: async (sessionId: string, sequence: number, recapContent: string): Promise<void> => {
		const collection = await chatService._getCollection(sessionId);
		const recapDocId = buildRecapId(sessionId);
		await upsertDocument(collection, recapDocId, recapContent, {
			type: SUFFIX.RECAP,
			sequence, // Sequence number it summarizes up to
			timestamp: new Date().toISOString(),
			sessionId,
		});
	},

	// Summary Operations
	storeSummary: async (sessionId: string, newSummary: string): Promise<void> => {
		const collection = await chatService._getCollection(sessionId);
		const summaryId = buildSummaryId(sessionId);
		const existingSummary = await chatService.getSummary(sessionId);

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

	getRecap: async (sessionId: string): Promise<string> => {
		const collection = await chatService._getCollection(sessionId);
		const recapId = buildRecapId(sessionId);

		try {
			const recap = await getDocumentById(collection, recapId);
			return recap || '';
		} catch (error) {
			console.warn(`No recap found for session ${sessionId}`);
			return '';
		}
	},

	getSummary: async (sessionId: string): Promise<string> => {
		const collection = await chatService._getCollection(sessionId);
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
		const collection = await chatService._getCollection(sessionId);

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
	loadChatTurns: async (
		sessionId: string,
		fixedOnly: boolean = false,
		beforeSequence?: number
	): Promise<ChatTurn[]> => {
		// Get collection from cache synchronously if possible
		const cachedCollection = chatService._sessionCollections.get(sessionId);
		const collection = cachedCollection || (await getSessionCollection(sessionId));

		if (!cachedCollection) {
			chatService._sessionCollections.set(sessionId, collection);
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
				limit: DEFAULT_LOAING_CHAT_TURN_COUNT,
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

	queryRecap: async (sessionId: string, queryText: string): Promise<string[]> => {
		const collection = await chatService._getCollection(sessionId);
		const summaryId = buildSummaryId(sessionId);

		try {
			const summary = await chatService.getSummary(sessionId);
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
		const collection = await chatService._getCollection(sessionId);
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
		const collection = await chatService._getCollection(sessionId);

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
			relevantDetail = await chatService.queryRecap(sessionId, userText);
		}

		// Fall back to full chat log if needed
		if (!relevantDetail.length || isFullLogQuery) {
			// Query both request and response messages for comprehensive context
			relevantDetail = await chatService.queryChatLog(
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

	getRecentTurns: async (sessionId: string, limit: number): Promise<ChatTurn[]> => {
		if (!sessionId) throw new Error('No active session.');
		try {
			const collection = await chatService._getCollection(sessionId);
			// Fetch 'full_turn' documents, sort by sequence descending, take limit
			const results = await collection.get({
				where: { type: 'full_turn', sessionId }, // Filter for full turns
				include: [IncludeEnum.Documents, IncludeEnum.Metadatas],
				// ChromaDB get limitation: Cannot easily sort by metadata value AND limit.
				// Fetch all and sort/slice in memory (acceptable for moderate history).
			});

			if (!results.ids || results.ids.length === 0) return [];

			const turns = results.ids
				.map((id, index) => {
					try {
						const meta = results.metadatas?.[index];
						const doc = results.documents?.[index];
						if (doc && meta && typeof meta.sequence === 'number') {
							const turnData = JSON.parse(doc) as ChatTurn;
							if (turnData.sequence === meta.sequence) return turnData;
						}
					} catch (e) {
						console.error(`Parse error for turn ${id}`);
					}
					return null;
				})
				.filter((t): t is ChatTurn => t !== null);

			turns.sort((a, b) => b.sequence - a.sequence); // Sort descending
			return turns.slice(0, limit).reverse(); // Take limit, then reverse for ascending
		} catch (error) {
			console.error(`Error fetching recent turns DB for session ${sessionId}:`, error);
			return [];
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
