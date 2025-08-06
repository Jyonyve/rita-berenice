// src/server/db/chromaDbClient.ts
import { ChromaClient, Collection, IncludeEnum, Where, WhereDocument } from 'chromadb';
import { COLLECTIONS, CollectionType } from './ChromaInterfaces.js';
import { MetadataType } from '#shared/config/constants.js';
import { ChromaResponse } from '#shared/api/ModuleResponse.js';
import { OpenAIEmbeddingFunction } from '@chroma-core/openai';

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
	// This check is important. It will cause the server to crash on startup
	// if the secret is not set, which is good practice (fail fast).
	throw new Error('FATAL: OPENAI_API_KEY secret is not set in the environment.');
}

const embedFnOpenAi = new OpenAIEmbeddingFunction({ apiKey, modelName: 'text-embedding-3-small' });
const host =
	process.env.APP_ENV === 'development'
		? 'chromadb-flyio.fly.dev'
		: 'rita-berenice-chromadb.fly.dev';
const port = 443;
const ssl = true;

if (!host || !port) {
	throw new Error(
		'ChromaDB environment variables (CHROMA_HOST, CHROMA_PORT, CHROMA_SSL) must be set.'
	);
} else {
	console.log(`host: ${host}, port: ${port}, ssl:${ssl}`);
}
const chromaClient = new ChromaClient({
	host,
	port, // Ensure port is a number
	ssl,
});

const logJsonPreview = (obj: any, length: number = 100): string => {
	if (obj === null || typeof obj === 'undefined') {
		return 'N/A'; // Or 'undefined'/'null' based on your preference
	}
	const str = JSON.stringify(obj);
	if (str.length <= length) {
		return str;
	}
	return `${str.substring(0, length)}...`;
};
// Retry wrapper
const withRetry = async <T>(fn: () => Promise<T>, retries = 1, delay = 1500): Promise<T> => {
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

/**
 * A centralized Map to cache all singleton Collection objects.
 * This avoids repetitive caching logic for each collection type.
 * Structure: Map<collectionName, Collection>
 */
const _collectionCache: Map<string, Collection> = new Map();

/**
 * A generic, caching helper for retrieving singleton collections using ChromaDB's
 * `getOrCreateCollection` method. This is more efficient than the previous
 * get-then-create-on-error pattern. It checks a local cache first to minimize DB calls.
 *
 * @param collectionName The name of the collection from the COLLECTIONS enum.
 * @returns A Promise that resolves to the ChromaDB Collection object.
 */
const _getOrCreateSingletonCollection = async (collectionName: string): Promise<Collection> => {
	if (_collectionCache.has(collectionName)) {
		console.log(`[ChromaClient] Cache HIT for collection: ${collectionName}`);
		return _collectionCache.get(collectionName)!;
	}

	console.log(`[ChromaClient] Cache MISS for ${collectionName}. Fetching or creating from DB...`);
	try {
		console.log(`[ChromaClient] Attempting to GET collection: ${collectionName}`);
		const collection = await withRetry(() =>
			chromaClient.getCollection({ name: collectionName, embeddingFunction: embedFnOpenAi })
		);
		_collectionCache.set(collectionName, collection);
		console.log(`[ChromaClient] Cache HIT for existing collection: ${collectionName}`);
		return collection;
	} catch (error) {
		console.log(`[ChromaClient] Collection ${collectionName} not found or fetch failed. Creating...`);
		const collection = await withRetry(() =>
			chromaClient.createCollection({
				name: collectionName,
				embeddingFunction: embedFnOpenAi,
				metadata: { name: collectionName, created: new Date().toString() },
			})
		);
		_collectionCache.set(collectionName, collection);
		console.log(`[ChromaClient] Collection ${collectionName} created and cached.`);
		return collection;
	}
};

const _returnResponse = (results: ChromaResponse): ChromaResponse => {
	const { ids, metadatas, documents, distances } = results;
	if (!ids || ids.length === 0) {
		console.log(`[ChromaClient._returnResponse] No documents found for the query.`);
		return { ids: [], metadatas: [], documents: [], distances: [] };
	}
	console.log(`[ChromaClient._returnResponse] Found ${ids.length} entries.`);
	return { ids, metadatas, documents, distances };
};

export const chromaDbClient = {
	// --- Collection Getters (Now refactored to use the generic helper) ---
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
	getTermCollection: (): Promise<Collection> => _getOrCreateSingletonCollection(COLLECTIONS.TERM),
	getChatCollection: (): Promise<Collection> => _getOrCreateSingletonCollection(COLLECTIONS.CHAT),
	getUserCollection: (): Promise<Collection> => _getOrCreateSingletonCollection(COLLECTIONS.USER),
	getSessionCollection: (): Promise<Collection> =>
		_getOrCreateSingletonCollection(COLLECTIONS.SESSION),

	/**
	 * 컬렉션의 전체 문서 수를 반환합니다.
	 * @param collection - 문서 수를 가져올 Collection 객체
	 * @returns 컬렉션 내 문서의 총 수
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

	// Enhanced CRUD operations with embedding support
	addRecord: async (
		collection: Collection,
		id: string,
		document: string,
		metadata: Record<string, any>,
		embedding?: number[] // Optional embedding
	): Promise<void> => {
		const params: any = { ids: [id], documents: [document], metadatas: [metadata] };
		if (embedding) {
			params.embeddings = [embedding];
		}
		await collection.add(params);
	},

	updateRecord: async (
		collection: Collection,
		id: string,
		document: string,
		metadata: Record<string, any>,
		embedding?: number[] // Optional embedding
	): Promise<void> => {
		const params: any = { ids: [id], documents: [document], metadatas: [metadata] };
		if (embedding) {
			params.embeddings = [embedding];
		}
		await collection.update(params);
	},

	upsertRecord: async (
		collection: Collection,
		id: string,
		document: string,
		metadata: Record<string, any>,
		embedding?: number[] // Optional embedding
	): Promise<void> => {
		const params: any = { ids: [id], documents: [document], metadatas: [metadata] };

		if (embedding) {
			params.embeddings = [embedding];
		}

		await collection.upsert(params);
	},

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

	getRecordsByMetadataType: async (
		collection: Collection,
		type: MetadataType,
		options: { offset?: number; limit?: number } = {}
	): Promise<ChromaResponse> => {
		const whereFilter: Where = { type: { $eq: type } }; // For just type

		console.log(
			`[ChromaClient.getDocumentsByMetadata] Fetching documents with filter: ${JSON.stringify(
				whereFilter
			)}`
		);

		try {
			const MAX = await collection.count(); // Ensure the collection is initialized

			const results = await collection.get({
				where: whereFilter,
				include: [IncludeEnum.documents, IncludeEnum.metadatas], // Include IDs (implicit), documents, and metadatas
				offset: options.offset,
				limit: options.limit ?? MAX,
			});

			return _returnResponse(results);
		} catch (error) {
			console.error(
				`[ChromaClient.getDocumentsByMetadata] Error fetching documents by metadata type:`,
				error
			);
			throw new Error(`ChromaDB get failed for type ${type}: ${(error as Error).message}`);
		}
	},

	getRecords: async (
		collection: Collection,
		where?: Where,
		whereDocument?: WhereDocument,
		limit?: number
	): Promise<ChromaResponse> => {
		try {
			console.log(
				`[ChromaClient.getRecords] filter: ${logJsonPreview(where)}, document: ${logJsonPreview(
					whereDocument
				)}, limit: ${limit}`
			);
			const MAX = await collection.count(); // Ensure the collection is initialized
			const results = await collection.get({
				include: [IncludeEnum.documents, IncludeEnum.metadatas],
				where: where,
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

	queryRecords: async (
		collection: Collection,
		queryTexts: string[],
		where?: Where,
		whereDocument?: WhereDocument,
		limit?: number
	): Promise<ChromaResponse[]> => {
		try {
			console.log(
				`[ChromaClient.queryRecords] Querying with text: "${queryTexts.join(
					'\n'
				)}...",\n filter: ${logJsonPreview(where)}, ${logJsonPreview(whereDocument)},\n limit: ${limit}`
			);
			const MAX = await collection.count(); // Ensure the collection is initialized
			const results = await collection.query({
				queryTexts, // queryTexts expects an array of strings
				nResults: limit ?? MAX,
				include: [IncludeEnum.documents, IncludeEnum.metadatas, IncludeEnum.distances], // Also include distances
				where, // Pass the metadata filter
				whereDocument,
			});

			return results.ids
				.map((id, i) => {
					const ids = results.ids[i];
					const documents = results.documents[i];
					const metadatas = results.metadatas[i];
					const distances: (number[] | null)[] | null | undefined =
						typeof results.distances[i] === 'number' ? [results.distances[i]] : null;
					return _returnResponse({ ids, documents, metadatas, distances });
				})
				.filter((r): r is ChromaResponse => r !== null);
		} catch (error) {
			console.error(`[ChromaClient.queryRecords] Failed to query records:`, error);
			throw new Error(`ChromaDB get failed for queryText ${queryTexts}: ${(error as Error).message}`);
		}
	},

	// Add batch operations for efficiency
	addRecordsBatch: async (
		collection: Collection,
		ids: string[],
		documents: string[],
		metadatas: Record<string, any>[],
		embeddings?: number[][]
	): Promise<void> => {
		const params: any = { ids, documents, metadatas };

		if (embeddings) {
			params.embeddings = embeddings;
		}

		await collection.add(params);
	},

	/**
	 * Upserts multiple records into a collection in a single batch operation.
	 * This is highly efficient for creating or updating many records at once.
	 */
	upsertRecords: async (
		collection: Collection,
		ids: string[],
		documents: string[],
		metadatas: Record<string, any>[],
		embeddings?: number[][] // Optional pre-computed embeddings
	): Promise<void> => {
		const params: any = { ids, documents, metadatas };

		if (embeddings) {
			params.embeddings = embeddings;
		}

		await collection.upsert(params);
	},

	deleteRecordById: async (collection: Collection, id: string): Promise<void> => {
		return await collection.delete({ ids: [id] });
	},

	/**
	 * Deletes multiple records from a collection using IDs and/or a where filter.
	 * At least one of 'ids' or 'where' must be provided.
	 * @param collection The ChromaDB Collection object.
	 * @param ids An optional array of record IDs to delete.
	 * @param where An optional where filter object to specify which records to delete.
	 */
	deleteRecords: async (collection: Collection, ids?: string[], where?: Where): Promise<void> => {
		// 1. Guard clause: Ensure at least one deletion criterion is provided.
		if ((!ids || ids.length === 0) && !where) {
			console.warn('[ChromaClient.deleteRecords] No IDs or where filter provided. Nothing to delete.');
			return;
		}

		// 2. Build the options object for the native .delete() method.
		const deleteOptions: { ids?: string[]; where?: Where } = {};
		if (ids && ids.length > 0) {
			deleteOptions.ids = ids;
		}
		if (where) {
			deleteOptions.where = where;
		}

		// 3. Call the native delete method with the constructed options.
		console.log('[ChromaClient.deleteRecords] Deleting with options:', deleteOptions);
		return await collection.delete(deleteOptions);
	},

	getOrCreateSingletonCollection: async (collection: CollectionType) => {
		return _getOrCreateSingletonCollection(collection);
	},

	countOption: async (collection: Collection, where: Where): Promise<number> => {
		const result = await collection.get({ where: where, include: [] });
		return result.ids.length;
	},
};
