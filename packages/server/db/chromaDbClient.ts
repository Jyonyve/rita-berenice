// src/server/db/chromaDbClient.ts
import {
	ChromaClient,
	Collection,
	GetResult,
	IncludeEnum,
	QueryResult,
	Where,
	WhereDocument,
} from 'chromadb';
import {
	COLLECTIONS,
	CollectionType,
	ChromaDbResponse,
	convertChromaResponse,
	convertToChromaMetadata,
} from './chroma.type.js';
import { OpenAIEmbeddingFunction } from '@chroma-core/openai';
import { CohereEmbeddingFunction } from '@chroma-core/cohere';
import { ChromaResponse, Metadata } from '@rita-berenice/shared/api';
import { MetadataType } from '@rita-berenice/shared/config';

const openAiApiKey = process.env.OPENAI_API_KEY;
const cohereApiKey = process.env.COHERE_API_KEY;

if (!cohereApiKey || !openAiApiKey) {
	throw new Error('FATAL: Both OPENAI_API_KEY and COHERE_API_KEY must be set in environment.');
}

// ✅ SIMPLIFIED: Direct embedding function assignments
const embedFnOpenAi = new OpenAIEmbeddingFunction({
	apiKey: openAiApiKey,
	modelName: 'text-embedding-3-small',
});

const embedFnCohere = new CohereEmbeddingFunction({
	apiKey: cohereApiKey,
	modelName: 'embed-v4.0',
	inputType: 'search_document',
});

const host = process.env.CHROMA_HOST;
const port = Number(process.env.CHROMA_PORT);
const ssl = process.env.CHROMA_SSL === 'true';

if (!host || !port || isNaN(port) || ssl === undefined) {
	throw new Error(
		'ChromaDB environment variables (CHROMA_HOST, CHROMA_PORT, CHROMA_SSL) must be set.'
	);
}

const chromaClient = new ChromaClient({ host, port, ssl });
const _collectionCache: Map<string, Collection> = new Map();

// ✅ SIMPLIFIED: Direct mapping without chooseEmbeddingFunction
const _getCollectionSpecificEmbedding = (collectionName: CollectionType) => {
	// Only TEMP uses Cohere for high-token capacity
	if (collectionName === COLLECTIONS.TEMP) {
		return embedFnCohere;
	}

	// All other collections use OpenAI
	return embedFnOpenAi;
};

const _withRetry = async <T>(fn: () => Promise<T>, retries = 1, delay = 1500): Promise<T> => {
	let lastError: unknown;
	for (let i = 0; i < retries; i++) {
		try {
			return await fn();
		} catch (err) {
			lastError = err;
			console.warn(`[ChromaRetry] Attempt ${i + 1} failed: ${(err as Error).message}`);
			await new Promise((res) => setTimeout(res, delay));
		}
	}
	throw lastError;
};

const _logJsonPreview = (obj: any, length: number = 100): string => {
	if (obj === null || typeof obj === 'undefined') {
		return 'N/A';
	}
	const str = JSON.stringify(obj);
	if (str.length <= length) {
		return str;
	}
	return `${str.substring(0, length)}...`;
};

const _getOrCreateSingletonCollection = async (
	collectionName: CollectionType
): Promise<Collection> => {
	if (_collectionCache.has(collectionName)) {
		console.log(`[ChromaClient] Cache HIT for collection: ${collectionName}`);
		return _collectionCache.get(collectionName)!;
	}

	console.log(`[ChromaClient] Cache MISS for ${collectionName}. Fetching or creating from DB...`);

	const embeddingFunction = _getCollectionSpecificEmbedding(collectionName);

	try {
		console.log(`[ChromaClient] Attempting to GET collection: ${collectionName}`);
		const collection = await _withRetry(() =>
			chromaClient.getCollection({ name: collectionName, embeddingFunction })
		);
		_collectionCache.set(collectionName, collection);
		console.log(`[ChromaClient] Collection ${collectionName} retrieved and cached.`);
		return collection;
	} catch (error) {
		console.log(`[ChromaClient] Collection ${collectionName} not found. Creating...`);
		const collection = await _withRetry(() =>
			chromaClient.createCollection({
				name: collectionName,
				embeddingFunction,
				metadata: {
					name: collectionName,
					created: new Date().toString(),
					embeddingModel:
						collectionName === COLLECTIONS.TEMP ? 'cohere-embed-v4.0' : 'openai-text-embedding-3-small',
					dimensions: 1536, // Both models use 1536 dimensions
				},
			})
		);
		_collectionCache.set(collectionName, collection);
		console.log(`[ChromaClient] Collection ${collectionName} created and cached.`);
		return collection;
	}
};

/**
 * Processes ChromaDB results into our internal ChromaDbResponse format
 * Handles both GetResult and QueryResult from ChromaDB
 */
const processChromaResult = (result: GetResult | QueryResult): ChromaDbResponse => {
	if ('distances' in result) {
		// QueryResult - has nested arrays
		const queryResult = result as QueryResult;
		return {
			ids: queryResult.ids.flat(),
			documents: queryResult.documents.flat(),
			metadatas: queryResult.metadatas.flat(),
			distances: queryResult.distances.flat(),
		};
	} else {
		// GetResult - has flat arrays
		const getResult = result as GetResult;
		return {
			ids: getResult.ids,
			documents: getResult.documents,
			metadatas: getResult.metadatas,
			distances: [],
		};
	}
};

/**
 * Universal response handler that processes ChromaDB results and converts to shared ChromaResponse
 * This is the main bridge between ChromaDB types and shared types
 */
const _returnResponse = (result: GetResult | QueryResult): ChromaResponse => {
	const chromaDbResponse = processChromaResult(result);
	return convertChromaResponse(chromaDbResponse);
};

export const chromaDbClient = {
	// --- Collection Getters ---
	getCredentialCollection: (): Promise<Collection> =>
		_getOrCreateSingletonCollection(COLLECTIONS.CREDENTIAL),
	getCharacterCollection: (): Promise<Collection> =>
		_getOrCreateSingletonCollection(COLLECTIONS.CHARACTER),
	getProfileCollection: (): Promise<Collection> =>
		_getOrCreateSingletonCollection(COLLECTIONS.PROFILE),
	getTempChatCollection: (): Promise<Collection> =>
		_getOrCreateSingletonCollection(COLLECTIONS.TEMP),
	getRecapCollection: (): Promise<Collection> => _getOrCreateSingletonCollection(COLLECTIONS.RECAP),
	getLoreCollection: (): Promise<Collection> => _getOrCreateSingletonCollection(COLLECTIONS.LORE),
	getHistoryCollection: (): Promise<Collection> =>
		_getOrCreateSingletonCollection(COLLECTIONS.HISTORY),
	getTermCollection: (): Promise<Collection> => _getOrCreateSingletonCollection(COLLECTIONS.TERM),
	getChatCollection: (): Promise<Collection> => _getOrCreateSingletonCollection(COLLECTIONS.CHAT),
	getUserCollection: (): Promise<Collection> => _getOrCreateSingletonCollection(COLLECTIONS.USER),
	getSessionCollection: (): Promise<Collection> =>
		_getOrCreateSingletonCollection(COLLECTIONS.SESSION),

	/**
	 * Gets the total number of documents in a collection.
	 */
	getCollectionCount: async (collection: Collection): Promise<number> => {
		try {
			const count = await collection.count();
			console.log(`[ChromaClient.getCollectionCount] Collection has ${count} documents.`);
			return count;
		} catch (error) {
			console.error('[ChromaClient.getCollectionCount] Error fetching collection count:', error);
			throw new Error(`ChromaDB count failed for collection: ${(error as Error).message}`);
		}
	},

	/**
	 * Adds a new record to a collection.
	 * Uses shared Metadata type for input, converts to ChromaDB format internally
	 */
	addRecord: async (
		collection: Collection,
		id: string,
		document: string,
		metadata: Metadata
	): Promise<void> => {
		const chromaMetadata = convertToChromaMetadata(metadata);
		const params = { ids: [id], documents: [document], metadatas: [chromaMetadata] };
		await collection.add(params);
	},

	/**
	 * Updates an existing record in a collection.
	 * Uses shared Metadata type for input, converts to ChromaDB format internally
	 */
	updateRecord: async (
		collection: Collection,
		id: string,
		document: string,
		metadata: Metadata
	): Promise<void> => {
		const chromaMetadata = convertToChromaMetadata(metadata);
		const params = { ids: [id], documents: [document], metadatas: [chromaMetadata] };
		await collection.update(params);
	},

	/**
	 * Upserts (insert or update) a single record in a collection.
	 * Uses shared Metadata type for input, converts to ChromaDB format internally
	 */
	upsertRecord: async (
		collection: Collection,
		id: string,
		document: string,
		metadata: Metadata
	): Promise<void> => {
		const chromaMetadata = convertToChromaMetadata(metadata);
		const params = { ids: [id], documents: [document], metadatas: [chromaMetadata] };
		await collection.upsert(params);
	},

	/**
	 * Upserts multiple records in a collection in a single batch operation.
	 * Uses shared Metadata type for input, converts to ChromaDB format internally
	 */
	upsertRecords: async (
		collection: Collection,
		ids: string[],
		documents: string[],
		metadatas: Metadata[],
		options?: { logTokenStats?: boolean }
	): Promise<void> => {
		const chromaMetadatas = metadatas.map(convertToChromaMetadata);
		const params = { ids, documents, metadatas: chromaMetadatas };
		await collection.upsert(params);
	},

	/**
	 * Retrieves a single record by its ID.
	 * Returns shared ChromaResponse type
	 */
	getRecordById: async (collection: Collection, id: string): Promise<ChromaResponse> => {
		try {
			const result = await collection.get({
				ids: [id],
				include: [IncludeEnum.metadatas, IncludeEnum.documents],
			});
			return _returnResponse(result);
		} catch (error) {
			console.error(`[ChromaClient.getRecordById] Error fetching data`, error);
			throw new Error(`ChromaDB get failed for ID ${id}: ${(error as Error).message}`);
		}
	},

	/**
	 * Retrieves records by metadata type with pagination support.
	 * Returns shared ChromaResponse type
	 */
	getRecordsByMetadataType: async (
		collection: Collection,
		type: MetadataType,
		options: { offset?: number; limit?: number } = {}
	): Promise<ChromaResponse> => {
		const whereFilter: Where = { type: { $eq: type } };

		console.log(
			`[ChromaClient.getRecordsByMetadataType] Fetching documents with filter: ${JSON.stringify(whereFilter)}`
		);

		try {
			const MAX = await collection.count();
			const results = await collection.get({
				where: whereFilter,
				include: [IncludeEnum.documents, IncludeEnum.metadatas],
				offset: options.offset,
				limit: options.limit ?? MAX,
			});

			return _returnResponse(results);
		} catch (error) {
			console.error(
				`[ChromaClient.getRecordsByMetadataType] Error fetching documents by metadata type:`,
				error
			);
			throw new Error(`ChromaDB get failed for type ${type}: ${(error as Error).message}`);
		}
	},

	/**
	 * Retrieves records with optional filtering and pagination.
	 * Returns shared ChromaResponse type
	 */
	getRecords: async (
		collection: Collection,
		where?: Where,
		whereDocument?: WhereDocument,
		limit?: number
	): Promise<ChromaResponse> => {
		try {
			console.log(
				`[ChromaClient.getRecords] filter: ${_logJsonPreview(where)}, document: ${_logJsonPreview(whereDocument)}, limit: ${limit}`
			);
			const MAX = await collection.count();
			const results = await collection.get({
				include: [IncludeEnum.documents, IncludeEnum.metadatas],
				where: where,
				whereDocument: whereDocument,
				limit: limit ?? MAX,
			});
			return _returnResponse(results);
		} catch (error) {
			console.error(`[ChromaClient.getRecords] Failed to query records:`, error);
			throw new Error(
				`ChromaDB get failed for where ${JSON.stringify(where)}: ${(error as Error).message}`
			);
		}
	},

	/**
	 * Performs semantic search on a collection using query texts.
	 * Returns an array of shared ChromaResponse objects, one for each query.
	 */
	queryRecords: async (
		collection: Collection,
		queryTexts: string[],
		where?: Where,
		whereDocument?: WhereDocument,
		limit?: number
	): Promise<ChromaResponse[]> => {
		try {
			console.log(
				`[ChromaClient.queryRecords] Querying with texts count: ${queryTexts.length}, first: "${queryTexts[0]?.substring(0, 10) || 'N/A'}...", filter: ${_logJsonPreview(where)}, limit: ${limit}`
			);

			const MAX = await collection.count();
			const results = await collection.query({
				queryTexts,
				nResults: limit ?? MAX,
				include: [IncludeEnum.documents, IncludeEnum.metadatas, IncludeEnum.distances],
				where,
				whereDocument,
			});

			// Check if we have results
			if (!results.ids || results.ids.length === 0) {
				console.log('[ChromaClient.queryRecords] No results found for query');
				return [];
			}

			// Process each query result - results.ids[i] contains results for queryTexts[i]
			const responses: ChromaResponse[] = [];

			for (let i = 0; i < results.ids.length; i++) {
				const queryIds = results.ids[i] || [];
				const queryDocuments = results.documents[i] || [];
				const queryMetadatas = results.metadatas[i] || [];
				const queryDistances = results.distances[i] || [];

				// Skip empty results
				if (queryIds.length === 0) {
					continue;
				}

				// Create ChromaDbResponse for this query's results
				const chromaDbResponse: ChromaDbResponse = {
					ids: queryIds,
					documents: queryDocuments,
					metadatas: queryMetadatas,
					distances: queryDistances,
				};

				// Convert to shared ChromaResponse format
				const chromaResponse = convertChromaResponse(chromaDbResponse);
				responses.push(chromaResponse);
			}

			console.log(`[ChromaClient.queryRecords] Processed ${responses.length} query responses`);
			return responses;
		} catch (error) {
			console.error(`[ChromaClient.queryRecords] Failed to query records:`, error);
			throw new Error(`ChromaDB query failed for queryTexts: ${(error as Error).message}`);
		}
	},

	/**
	 * Adds multiple records to a collection in a single batch operation.
	 * Uses shared Metadata type for input, converts to ChromaDB format internally
	 */
	addRecordsBatch: async (
		collection: Collection,
		ids: string[],
		documents: string[],
		metadatas: Metadata[],
		embeddings?: number[][]
	): Promise<void> => {
		const chromaMetadatas = metadatas.map(convertToChromaMetadata);
		const params: any = { ids, documents, metadatas: chromaMetadatas };

		if (embeddings) {
			params.embeddings = embeddings;
		}

		await collection.add(params);
	},

	/**
	 * Deletes a single record by ID.
	 */
	deleteRecordById: async (collection: Collection, id: string): Promise<void> => {
		return await collection.delete({ ids: [id] });
	},

	/**
	 * Deletes multiple records from a collection using IDs and/or a where filter.
	 * At least one of 'ids' or 'where' must be provided.
	 */
	deleteRecords: async (collection: Collection, ids?: string[], where?: Where): Promise<void> => {
		// Guard clause: Ensure at least one deletion criterion is provided
		if ((!ids || ids.length === 0) && !where) {
			console.warn('[ChromaClient.deleteRecords] No IDs or where filter provided. Nothing to delete.');
			return;
		}

		// Build the options object for the native .delete() method
		const deleteOptions: { ids?: string[]; where?: Where } = {};
		if (ids && ids.length > 0) {
			deleteOptions.ids = ids;
		}
		if (where) {
			deleteOptions.where = where;
		}

		// Call the native delete method with the constructed options
		console.log('[ChromaClient.deleteRecords] Deleting with options:', deleteOptions);
		return await collection.delete(deleteOptions);
	},

	/**
	 * Counts records matching a where filter.
	 */
	countOption: async (collection: Collection, where: Where): Promise<number> => {
		const result = await collection.get({ where: where, include: [] });
		return result.ids.length;
	},

	/**
	 * Clears the collection cache. Useful for testing or memory management.
	 */
	clearCollectionCache: (): void => {
		_collectionCache.clear();
		console.log('[ChromaClient] Collection cache cleared.');
	},

	/**
	 * Internal helper for response processing (exposed for testing/debugging)
	 */
	_returnResponse,

	/**
	 * Internal helper for processing ChromaDB results (exposed for testing/debugging)
	 */
	_processChromaResult: processChromaResult,
};

export default chromaDbClient;
