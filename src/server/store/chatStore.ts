import { Collection, Metadata, Where, WhereDocument } from 'chromadb';
import { chromaDbClient } from '../db/chromaDbClient.js';

import { COLLECTIONS } from '../db/ChromaInterfaces.js';
import { METADATA_TYPES } from '#shared/config/constants.js';
import {
	ChatIndexContentType,
	ChatIndexMetadata,
	ChatTurn,
	ChatTurnMetadata,
	DisplayTurn,
} from '#shared/domain/chat/ChatInterfaces.js';
import { chatTurnToDocument } from '#server/util/documentUtils.js';
import { ApiError } from '#shared/domain/error/errors.js';
import { handleServiceError, validateChromaResponse } from '../util/serviceHelpers.js';
import {
	chatTurnToMetadata,
	metadataToChatTurn,
	metadataToDisplayTurn,
} from '#shared/util/dbConvertUtils.js';
import { ChatResponse } from '#shared/api/ModuleResponse.js';
import { buildChatTurnIndexId, buildChatTurnId } from '#shared/util/buildIdUtils.js';
import { FilterCriteria } from '../util/schemaUtils.js';
import {
	getTokenCount,
	MEMORY_CONFIG,
	prioritizeRecentTurns,
	reRankSemanticResults,
} from '../util/queryUtils.js';
import { parseEntriesToConversation } from '../util/chatParseUtils.js';
import { DEFAULT_EMOTION } from '#shared/config/emotionConstants.js';
import { mapEmotionToCategory, isValidEmotion } from '#shared/util/emotionUtils.js';

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

/**
 * Helper function to build semantic emotion queries for better search
 */
const buildEmotionSearchQueries = (emotion: string): string[] => [
	`user feeling ${emotion}`, // Direct emotional state
	`character reacting to ${emotion}`, // Character response context
	`conversation about ${emotion}`, // Topic-based
	`${emotion} emotional interaction`, // Interaction-based
	`emotional state ${emotion}`, // State-based
	`${emotion} mood context`, // Mood-based
];

/**
 * Safe emotion categorization with fallback for unknown emotions
 */
const getEmotionCategoryWithFallback = (emotion: string): string => {
	if (!emotion) return 'neutral';

	// First try exact match from your curated list
	if (isValidEmotion(emotion)) {
		return mapEmotionToCategory(emotion);
	}

	// For unknown emotions, use generic 'nuance' category to avoid warnings
	// Let vector search handle semantic similarity naturally
	return 'nuance';
};

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
	 * Creates or updates semantic-rich search index records for a given ChatTurn.
	 * Enhanced with semantic emotion handling.
	 */
	_updateSearchIndexForTurn: async (turn: ChatTurn): Promise<void> => {
		const collection = await chatStore._getChatCollection();

		// Delete existing index entries
		const oldIndexWhere: Where = {
			$and: [{ type: { $eq: METADATA_TYPES.INDEX } }, { chatTurnId: { $eq: turn.chatTurnId } }],
		};
		await collection.delete({ where: oldIndexWhere });

		const newIndexRecords: { id: string; document: string; metadata: ChatIndexMetadata }[] = [];
		const baseMetadata = {
			type: METADATA_TYPES.INDEX,
			chatTurnId: turn.chatTurnId,
			sessionId: turn.sessionId,
			characterId: turn.characterId,
			originalCreatedAt: turn.createdAt,
		};

		// Enhanced context for richer semantic understanding
		const conversationContext = `User said: "${
			parseEntriesToConversation(turn.request.entries)?.slice(0, 200) || 'interaction'
		}" Character ${turn.characterId} responded: "${
			parseEntriesToConversation(turn.response.entries)?.slice(0, 200) || 'response'
		}"`;
		const topicsContext = turn.topicList?.length
			? `Topics: ${turn.topicList.join(', ')}`
			: 'General conversation';
		const relationshipContext = turn.relationshipShiftList?.length
			? `Relationship: ${turn.relationshipShiftList.join(', ')}`
			: 'Stable dynamic';

		// Create semantic-searchable documents for different content types
		const createSemanticIndexRecords = (
			list: string[],
			contentType: ChatIndexContentType,
			contextDescription: string
		) => {
			if (!list || list.length === 0) return;

			list.forEach((value, index) => {
				// Create rich document content for semantic search
				const semanticDocument = `${contextDescription}: ${value}. ${conversationContext}. ${topicsContext}. ${relationshipContext}. User emotion: ${
					turn.userEmotion?.primary || DEFAULT_EMOTION
				}, Character emotion: ${turn.characterEmotion?.primary || DEFAULT_EMOTION}`;

				const tokenCount = getTokenCount(value);

				newIndexRecords.push({
					id: buildChatTurnIndexId(turn.chatTurnId, contentType),
					document: semanticDocument,
					metadata: {
						...baseMetadata,
						contentType,
						value,
						semanticContext: contextDescription,
						tokenCount,
						// Default values for non-emotion records
						emotionCategory: DEFAULT_EMOTION,
						emotionIntensity: 0.5,
						emotionType: 'primary',
					},
				});
			});
		};

		// Create semantic index records with rich context
		createSemanticIndexRecords(
			turn.keywordList,
			'KEYWORD',
			'Key concept or important term discussed'
		);
		createSemanticIndexRecords(turn.topicList, 'TOPIC', 'Main topic or theme of conversation');
		createSemanticIndexRecords(turn.entityList, 'ENTITY', 'Person, place, or thing mentioned');
		createSemanticIndexRecords(turn.actionList, 'ACTION', 'Action taken or behavior observed');
		createSemanticIndexRecords(
			turn.flagList,
			'FLAG',
			'Important flag or marker for this conversation'
		);
		createSemanticIndexRecords(
			turn.relationshipShiftList,
			'RELATIONSHIP_SHIFT',
			'Change in relationship dynamic'
		);

		// Enhanced emotion indexing with semantic context - NO MORE MAPPING ERRORS
		if (turn.userEmotion?.nuanceList?.length) {
			turn.userEmotion.nuanceList.forEach((emotion, index) => {
				// Rich semantic emotion document for better matching
				const emotionDocument = `User emotional nuance: ${emotion}. Emotional situation: ${
					turn.summary || 'conversation interaction'
				}. ${conversationContext}. ${topicsContext}. Character responded with ${
					turn.characterEmotion?.primary || 'neutral'
				} emotion. ${relationshipContext}`;

				const tokenCount = getTokenCount(emotion);

				newIndexRecords.push({
					id: buildChatTurnIndexId(turn.chatTurnId, 'USER_EMOTION_NUANCE'),
					document: emotionDocument,
					metadata: {
						...baseMetadata,
						contentType: 'USER_EMOTION_NUANCE',
						value: emotion, // Keep original emotion for exact matching
						semanticContext: 'User emotional expression and feeling',
						tokenCount,
						// Use safe fallback - no more unknown emotion warnings!
						emotionCategory: getEmotionCategoryWithFallback(emotion),
						emotionIntensity: turn.userEmotion.intensity || 0.5,
						emotionType: 'nuance',
					},
				});
			});
		}

		if (turn.characterEmotion?.nuanceList?.length) {
			turn.characterEmotion.nuanceList.forEach((emotion, index) => {
				// Rich semantic emotion document for character responses
				const emotionDocument = `Character ${
					turn.characterId
				} emotional nuance: ${emotion}. Response situation: ${
					turn.summary || 'character reaction'
				}. ${conversationContext}. Character personality context: ${
					turn.characterId
				}. ${relationshipContext}. User was feeling ${turn.userEmotion?.primary || 'neutral'}`;

				const tokenCount = getTokenCount(emotion);

				newIndexRecords.push({
					id: buildChatTurnIndexId(turn.chatTurnId, 'CHARACTER_EMOTION_NUANCE'),
					document: emotionDocument,
					metadata: {
						...baseMetadata,
						contentType: 'CHARACTER_EMOTION_NUANCE',
						value: emotion, // Keep original emotion
						semanticContext: 'Character emotional reaction and response',
						tokenCount,
						// Use safe fallback - no more warnings!
						emotionCategory: getEmotionCategoryWithFallback(emotion),
						emotionIntensity: turn.characterEmotion.intensity || 0.5,
						emotionType: 'nuance',
					},
				});
			});
		}

		// Batch upsert the enriched index records
		if (newIndexRecords.length > 0) {
			await chromaDbClient.upsertRecords(
				collection,
				newIndexRecords.map((r) => r.id),
				newIndexRecords.map((r) => r.document),
				newIndexRecords.map((r) => r.metadata)
			);
		}
	},

	/**
	 * @private
	 * Enhanced metadata filtering with semantic emotion search support
	 */
	_buildIndexWhereClause(sessionId: string, criteria: FilterCriteria): Where | undefined {
		const andConditions: Where[] = [];

		// Base session filter
		andConditions.push({ sessionId: { $eq: sessionId } });
		andConditions.push({ type: { $eq: METADATA_TYPES.INDEX } });

		// More restrictive OR conditions - require higher relevance
		const orConditions: Where[] = [];

		// Prioritize exact keyword/topic matches
		const addExactConditions = (list: string[] | undefined, type: ChatIndexContentType) => {
			if (!list || list.length === 0) return;

			// Only take top 70% most relevant terms for selectivity
			const topTerms = list.slice(0, Math.ceil(list.length * 0.7));

			topTerms.forEach((item) => {
				orConditions.push({
					$and: [
						{ contentType: { $eq: type } },
						{ value: { $eq: item } }, // Use exact match only
					],
				});
			});
		};

		// Prioritize topics and keywords over other metadata
		addExactConditions(criteria.topics, 'TOPIC');
		addExactConditions(criteria.keywords, 'KEYWORD');

		// Be more selective with entities
		if (criteria.entities?.characters?.length) {
			criteria.entities.characters.slice(0, 2).forEach((char) => {
				orConditions.push({
					$and: [
						{ contentType: { $eq: 'ENTITY' } },
						{ value: { $eq: char } }, // Exact match for entities
					],
				});
			});
		}

		// Enhanced emotion filtering - try multiple semantic approaches
		if (criteria.emotion && criteria.emotion !== 'neutral') {
			const emotionCategory = getEmotionCategoryWithFallback(criteria.emotion);

			// Exact emotion match
			orConditions.push({
				$and: [{ contentType: { $eq: 'USER_EMOTION_NUANCE' } }, { value: { $eq: criteria.emotion } }],
			});

			orConditions.push({
				$and: [
					{ contentType: { $eq: 'CHARACTER_EMOTION_NUANCE' } },
					{ value: { $eq: criteria.emotion } },
				],
			});

			// Category fallback only if we have a valid mapped category
			if (emotionCategory !== 'nuance') {
				orConditions.push({
					$and: [
						{ contentType: { $eq: 'USER_EMOTION_NUANCE' } },
						{ emotionCategory: { $eq: emotionCategory } },
					],
				});

				orConditions.push({
					$and: [
						{ contentType: { $eq: 'CHARACTER_EMOTION_NUANCE' } },
						{ emotionCategory: { $eq: emotionCategory } },
					],
				});
			}
		}

		if (orConditions.length === 0) {
			return undefined; // No filter - will get recent turns
		}

		return { $and: [...andConditions, { $or: orConditions }] };
	},

	/**
	 * Stores a fully enriched chat turn and updates its search index.
	 * This is the single, authoritative method for saving a finalized turn.
	 */
	storeChatTurn: async (turn: ChatTurn): Promise<{ chatTurnId: string }> => {
		try {
			const collection = await chatStore._getChatCollection();

			// 1. Prepare and store the primary TURN document
			const metadata = chatTurnToMetadata(turn);
			const document = chatTurnToDocument(turn);
			await upsertRecord(collection, metadata.chatTurnId, document, metadata);

			// 2. Update the denormalized search index for this turn
			await chatStore._updateSearchIndexForTurn(turn);
			return { chatTurnId: turn.chatTurnId };
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

			// Step 2: Update the search index for EACH turn with progress logging
			console.log(`[chatStore] Now updating indexes for ${chatTurns.length} turns...`);
			let processedCount = 0;
			for (const turn of chatTurns) {
				await chatStore._updateSearchIndexForTurn(turn);
				processedCount++;
				// Log progress every 10 items or on the very last item to avoid spamming the console
				if (processedCount % 10 === 0 || processedCount === chatTurns.length) {
					console.log(`[chatStore] -> Updated index for turn ${processedCount} of ${chatTurns.length}`);
				}
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
	/**
	 * Enhanced query with semantic emotion search
	 */
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

			// Enhance query texts with emotion semantics if emotion criteria is provided
			let enhancedQueryTexts = [...queryTexts];
			if (filterCriteria?.emotion) {
				const emotionQueries = buildEmotionSearchQueries(filterCriteria.emotion);
				enhancedQueryTexts = [...enhancedQueryTexts, ...emotionQueries];
			}

			// Step 1: Enhanced pre-filtering with metadata
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
					].filter(Boolean);

					if (matchingTurnIds.length === 0) {
						console.log('[chatStore] No turns found matching metadata filter. Returning empty.');
						return emptyChatResponse();
					}

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

			// Step 2: Perform vector search with enhanced queries
			const queryWhere: Where = {
				$and: [{ type: { $eq: METADATA_TYPES.TURN } }, { sessionId: { $eq: sessionId } }],
			};

			if (turnIdsToSearch) {
				queryWhere.$and?.push({ chatTurnId: { $in: turnIdsToSearch } });
			}

			// Use higher limit for vector search to get better candidates for ranking
			const searchLimit = limit ? Math.min(limit * 3, 50) : 30;
			console.log('[chatStore] Querying TURN docs with enhanced queries:', enhancedQueryTexts.length);

			const queryResults = await queryRecords(
				collection,
				enhancedQueryTexts, // Use enhanced queries with emotion semantics
				queryWhere,
				whereDocument,
				searchLimit
			);

			// Step 3: Validate results
			const validatedResults = queryResults.map((r) =>
				validateChromaResponse(r, 'getList', collectionType)
			);

			// Step 4: Apply semantic + recency ranking
			const rankedResults = reRankSemanticResults(validatedResults, limit, {
				semanticWeight: 0.7,
				recencyWeight: 0.3,
				updatedAtField: 'updatedAt',
			});

			if (rankedResults.ids.length === 0) {
				return emptyChatResponse();
			}

			// Step 5: Reconstruct ChatTurns
			const chatTurnIds: string[] = rankedResults.metadatas
				.map((m) => (m as any)?.chatTurnId)
				.filter((id): id is string => typeof id === 'string');

			const indexMetadatas = await chatStore._constructChatTurnIndexes(chatTurnIds);
			const chatTurns = chatStore._constructFullChatTurns(rankedResults.metadatas, indexMetadatas);

			return {
				ids: rankedResults.ids,
				metadatas: rankedResults.metadatas,
				documents: rankedResults.documents,
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
	 */
	_deleteChatTurn: async (chatTurnId: string): Promise<void> => {
		try {
			const collection = await chatStore._getChatCollection();

			// --- Step 1: Delete all associated index records ---
			const indexWhere: Where = {
				$and: [{ type: { $eq: METADATA_TYPES.INDEX } }, { chatTurnId: { $eq: chatTurnId } }],
			};

			await deleteRecords(collection, undefined, indexWhere);
			console.log(`[chatStore] Deleted index records for turn: ${chatTurnId}`);

			// --- Step 2: Delete the primary chat turn document ---
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
