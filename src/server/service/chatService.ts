import type {
	ChatTurn,
	ChatMessageType,
	AiModelInfo,
	TempChatTurn,
} from '#root/src/shared/domain/index.ts';
import {
	parseEntriesToText,
	buildMessageId,
	buildTurnId,
	SUFFIX,
	DEFAULT_LOADING_TURN_COUNT,
	DEFAULT_RECAP_INTERVAL,
	buildChatTurnToJsonString,
	DEFAULT_RECAP_MODEL_FREE,
	DEFAULT_RECENT_TURN_COUNT,
	METADATA_TYPES,
} from '#root/src/shared/index.ts';
import { Collection, IncludeEnum } from 'chromadb';
import { chromaDbClient } from '#server/db/chromaDbClient.ts';
import { llmService } from './llmService.ts';

// Destructure outside the object
const {
	getSessionCollection,
	getTempChatCollection,
	getRecapCollection,
	upsertDocument,
	getDocumentById,
	deleteDocumentById,
	queryDocuments,
} = chromaDbClient;

export const chatService = {
	// Cache for session collections
	_sessionCollections: new Map<string, Collection>(),
	_tempChatCollection: null as Collection | null,
	_recapCollection: null as Collection | null,

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
	_getRecapCollection: async (): Promise<Collection> => {
		if (chatService._recapCollection) return chatService._recapCollection;
		const collection = await getRecapCollection();
		chatService._recapCollection = collection;
		return collection;
	},

	// store fixed chat turn as json string
	_storeFullChatTurn: async (chatTurn: ChatTurn): Promise<void> => {
		const { sessionId, sequence, request } = chatTurn;
		const collection = await chatService._getCollection(sessionId);
		const turnId = buildTurnId(sessionId, sequence);
		await upsertDocument(collection, turnId, JSON.stringify(chatTurn), {
			type: METADATA_TYPES.SET,
			sessionId,
			sequence,
			timestamp: request.timestamp,
		});
	},

	_storeRecap: async (sessionId: string, sequence: number): Promise<void> => {
		// validation
		if (sequence === 0 || sequence % DEFAULT_RECAP_INTERVAL !== 0) return;
		// 1. Fetch recent turns from DB
		const turnsForRecap = await chatService.getRecentChatTurns(sessionId, DEFAULT_RECAP_INTERVAL);
		if (turnsForRecap.length === 0) {
			console.warn(`No turns found for recap generation (Session: ${sessionId}, Seq: ${sequence})`);
			return;
		}

		// 2. Format prompt
		const recapPromptContent = `Create a concise recap of the key points from the following recent chat turns:\n${turnsForRecap
			.map((turn) => buildChatTurnToJsonString(turn)) // Ensure util is available
			.join('\n\n')}`;

		// 3. Get Recap Model Info (use default or allow configuration later)
		const recapModelInfo = DEFAULT_RECAP_MODEL_FREE; // Use keyless default shared constant

		// 4. Invoke LLM via llmService
		const recapContent = await llmService.invokeLlm('system', recapPromptContent, recapModelInfo); // Use invokeLlm

		if (!recapContent || recapContent.startsWith('[Error')) {
			console.warn(`Recap generation for sequence ${sequence} returned empty/error.`);
			return;
		}

		// 5. Save the Recap
		const collection = await chatService._getRecapCollection();
		await upsertDocument(collection, sessionId, recapContent, {
			type: METADATA_TYPES.RECAP,
			sequence,
			timestamp: new Date().toISOString(),
			sessionId,
		});
		console.log(
			`Successfully generated and saved recap for sequence No ${sequence}, session ${sessionId}.`
		);
	},

	_parseToChatTurns(
		ids: string[],
		documents: (string | null)[],
		metadatas: (Record<string, any> | null)[]
	): ChatTurn[] {
		return ids
			.map((id, index) => {
				const doc = documents[index];
				const meta = metadatas[index];
				if (!doc || !meta || typeof meta.sequence !== 'number' || meta.type !== METADATA_TYPES.SET) {
					console.warn(`Skipping invalid turn data for ID ${id}`);
					return null;
				}

				try {
					const turnData = JSON.parse(doc) as ChatTurn;
					if (turnData.sequence === meta.sequence) return turnData;

					console.warn(`Sequence mismatch for ID ${id}`);
					return null;
				} catch (e) {
					console.error(`Failed to parse chat turn for ID ${id}:`, e);
					return null;
				}
			})
			.filter((t): t is ChatTurn => t !== null);
	},

	// --- Temporary Turn Operations ---
	saveTempChatTurn: async (tempData: TempChatTurn): Promise<void> => {
		if (!tempData.sessionId || !tempData.chatTurnSets) throw new Error('Invalid temp chat data.');

		const collection = await chatService._getTempCollection();
		await upsertDocument(collection, tempData.sessionId, JSON.stringify(tempData), {
			type: METADATA_TYPES.TEMP,
			sessionId: tempData.sessionId,
			timestamp: new Date().toISOString(),
			setCount: tempData.chatTurnSets?.length ?? 0,
		});
		console.log(`Stored temp data for session ${tempData.sessionId}`);
	},

	getTempChatTurn: async (sessionId: string): Promise<TempChatTurn | null> => {
		if (!sessionId) return null;
		try {
			const collection = await chatService._getTempCollection(); // Assumes _getTempCollection exists
			const docContent = await chromaDbClient.getDocumentById(collection, sessionId);
			if (!docContent) return null;
			return JSON.parse(docContent) as TempChatTurn;
		} catch (error) {
			console.error(`Error fetching or parsing temp turn for session ${sessionId}:`, error);
			return null;
		}
	},

	removeTempChatTurn: async (sessionId: string): Promise<void> => {
		if (!sessionId) return;
		try {
			const collection = await chatService._getTempCollection();
			await deleteDocumentById(collection, sessionId);
			console.log(`Deleted temp data for session ${sessionId}`);
		} catch (error) {
			throw new Error('fail to delete temporary chat turn');
		}
	},

	// Store request (public for non-regen editing)
	storeRequest: async (chatTurn: ChatTurn): Promise<void> => {
		const { sessionId, sequence, request } = chatTurn;
		const collection = await chatService._getCollection(sessionId);
		const requestContent = parseEntriesToText(request.entries);
		const requestId = buildMessageId(sessionId, sequence, 'request');
		await upsertDocument(collection, requestId, requestContent, {
			type: METADATA_TYPES.MESSAGE,
			messageType: SUFFIX.REQUEST,
			sessionId,
			sequence,
			role: request.role,
			timestamp: request.timestamp,
		});
	},
	// Store response (public for non-regen editing)
	storeResponse: async (chatTurn: ChatTurn): Promise<void> => {
		const { sessionId, sequence, response } = chatTurn;
		const collection = await chatService._getCollection(sessionId);
		const responseContent = parseEntriesToText(response.entries);
		const responseId = buildMessageId(sessionId, sequence, 'response');
		await upsertDocument(collection, responseId, responseContent, {
			type: METADATA_TYPES.MESSAGE,
			messageType: SUFFIX.RESPONSE,
			sessionId,
			sequence,
			role: response.role,
			timestamp: response.timestamp,
		});
	},

	// Chat Turn Operations
	storeChatTurn: async (chatTurn: ChatTurn): Promise<void> => {
		// validation
		if (!chatTurn || typeof chatTurn.sequence !== 'number' || !chatTurn.sessionId) {
			throw new Error('Invalid ChatTurn data received.');
		}
		const sessionId = chatTurn.sessionId;
		await chatService.storeRequest(chatTurn);
		await chatService.storeResponse(chatTurn);

		// Store the full turn as JSON only when it's fixed
		await chatService._storeFullChatTurn(chatTurn);
		await chatService.removeTempChatTurn(sessionId);
		await chatService._storeRecap(sessionId, chatTurn.sequence);
	},

	getRecap: async (sessionId: string): Promise<string> => {
		const collection = await chatService._getRecapCollection();

		try {
			const recap = await getDocumentById(collection, sessionId);
			return recap || '';
		} catch (error) {
			console.warn(`No recap found for session ${sessionId}`);
			return '';
		}
	},

	// Enhanced Query Operations
	queryChatLog: async (
		sessionId: string,
		queryText: string,
		messageTypes: ChatMessageType[],
		limit?: number
	): Promise<string[]> => {
		const collection = await chatService._getCollection(sessionId);

		try {
			// Create a where clause that includes the specified message types
			const whereClause: Record<string, any> = {
				type: METADATA_TYPES.MESSAGE,
				messageType: { $in: messageTypes },
			};
			return await queryDocuments(collection, queryText, whereClause, limit ?? -1);
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
	): Promise<ChatTurn[]> => {
		if (!sessionId) throw new Error('Session ID is required.');
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
			if (!results.ids) return [];
			const parsedTurns = chatService._parseToChatTurns(
				results.ids,
				results.documents,
				results.metadatas
			);
			parsedTurns.sort((a, b) => b.sequence - a.sequence);
			const limitedTurns = parsedTurns.slice(0, limit);
			return limitedTurns.reverse();
		} catch (error) {
			console.error(
				`Error fetching chat turns before ${beforeSequence} for session ${sessionId}:`,
				error
			);
			return []; // Return empty array on error
		}
	},

	/** Loads multiple FIXED turns */
	getRecentChatTurns: async (
		sessionId: string,
		limit: number = DEFAULT_RECENT_TURN_COUNT
	): Promise<ChatTurn[]> => {
		if (!sessionId) throw new Error('Session ID is required.');

		const collection = await chatService._getCollection(sessionId);
		try {
			const whereClause: Record<string, any> = {
				type: METADATA_TYPES.SET, // Only fetch fixed, full turn documents
				sessionId,
			};
			// Fetch FULL_TURN documents, sort by sequence descending, take limit
			const results = await collection.get({
				where: whereClause,
				include: [IncludeEnum.Documents, IncludeEnum.Metadatas],
			});

			if (!results.ids || results.ids.length === 0) {
				return [];
			}

			const parsedTurns = chatService._parseToChatTurns(
				results.ids,
				results.documents,
				results.metadatas
			);

			parsedTurns.sort((a, b) => b.sequence - a.sequence);

			const limitedTurns = parsedTurns.slice(0, limit);
			return limitedTurns.reverse();
		} catch (error) {
			console.error(`Error fetching recent fixed turns for session ${sessionId}:`, error);
			return [];
		}
	},

	/** Get recap document */
	queryRecap: async (sessionId: string): Promise<string> => {
		return await chatService.getRecap(sessionId);
	},

	/** Gets a single FIXED turn by sequence */
	getChatTurnBySequence: async (sessionId: string, sequence: number): Promise<ChatTurn | null> => {
		const collection = await chatService._getCollection(sessionId);
		const turnId = buildTurnId(sessionId, sequence);
		try {
			const turnJson = await getDocumentById(collection, turnId);
			if (!turnJson) return null;
			const turn = JSON.parse(turnJson) as ChatTurn & { isFixed?: boolean };
			return turn.isFixed === true ? turn : null; // Check if fixed
		} catch (error) {
			/*...*/ return null;
		}
	},

	/** Builds user' enhanced prompt using recap or fixed logs */
	buildUserPromptFromLog: async (
		sessionId: string,
		userText: string,
		isFullLogQuery = false
	): Promise<string> => {
		let context = '';
		if (!isFullLogQuery) {
			context = await chatService.getRecap(sessionId); // Try recap first
		}
		if (!context) {
			// Fallback to recent fixed turns
			const turns = await chatService.getRecentChatTurns(sessionId, DEFAULT_LOADING_TURN_COUNT); // Adjust limit as needed
			context = turns
				.map(
					(t) =>
						`Seq ${t.sequence}: User: ${parseEntriesToText(t.request.entries)} Assistant: ${parseEntriesToText(t.response.entries)}`
				)
				.join('\n');
		}
		return context
			? `Use the following context if relevant, otherwise ignore it.\nContext:\n${context}\n\nUser: ${userText}`
			: userText;
	},

	// Method to clear the cache if needed (e.g., for testing or memory management)
	clearCollectionCache: (sessionId?: string): void => {
		if (sessionId) {
			chatService._sessionCollections.delete(sessionId);
		} else {
			chatService._sessionCollections.clear();
		}
	},

	// // Summary Operations TODO: should be triggered manually for extract logs
	// storeSummary: async (sessionId: string, newSummary: string): Promise<void> => {
	// 	const collection = await chatService._getCollection(sessionId);
	// 	const summaryId = buildSummaryId(sessionId);
	// 	const existingSummary = await chatService.getSummary(sessionId);

	// 	const updatedSummary = existingSummary ? `${existingSummary}\n---\n${newSummary}` : newSummary;

	// 	// Get existing metadata to extract updateCount
	// 	let updateCount = 0;
	// 	try {
	// 		const existingMetadata = await collection.get({
	// 			ids: [summaryId],
	// 			include: [IncludeEnum.Metadatas],
	// 		});

	// 		// Safely access the updateCount with null checks
	// 		if (
	// 			existingMetadata.metadatas &&
	// 			existingMetadata.metadatas.length > 0 &&
	// 			existingMetadata.metadatas[0] !== null
	// 		) {
	// 			const count = existingMetadata.metadatas[0].updateCount;
	// 			// Ensure we're dealing with a number
	// 			updateCount = typeof count === 'number' ? count + 1 : 1;
	// 		}
	// 	} catch (error) {
	// 		// If there's an error, just use 0 as the default
	// 		updateCount = 0;
	// 	}

	// 	await upsertDocument(collection, summaryId, updatedSummary, {
	// 		type: 'summary',
	// 		sessionId,
	// 		timestamp: new Date().toISOString(),
	// 		updateCount,
	// 	});
	// },

	// getSummary: async (sessionId: string): Promise<string> => {
	// 	const collection = await chatService._getCollection(sessionId);
	// 	const summaryId = buildSummaryId(sessionId);

	// 	try {
	// 		const summary = await getDocumentById(collection, summaryId);
	// 		return summary || '';
	// 	} catch (error) {
	// 		console.warn(`No summary found for session ${sessionId}`);
	// 		return '';
	// 	}
	// },
};
