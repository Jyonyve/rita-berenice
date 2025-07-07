// src/server/db/chromaDbClient.ts
import { ChromaClient, Collection, IncludeEnum, Where, WhereDocument } from 'chromadb';
import { COLLECTIONS } from './ChromaInterfaces.js';
import { MetadataType } from '#shared/config/constants.js';
import { ChromaResponse } from '#shared/api/ModuleResponse.js';
import { OpenAIEmbeddingFunction } from '@chroma-core/openai';

const apiKey = '';
if (!apiKey) {
	// This check is important. It will cause the server to crash on startup
	// if the secret is not set, which is good practice (fail fast).
	throw new Error('FATAL: OPENAI_API_KEY secret is not set in the environment.');
}

const embedFnOpenAi = new OpenAIEmbeddingFunction({ apiKey, modelName: 'text-embedding-3-small' });

const CHROMA_HOST = process.env.CHROMA_HOST || 'chromadb-flyio.fly.dev';
const CHROMA_PORT = Number(process.env.CHROMA_PORT) || 443;
const CHROMA_SSL = true; // Your URL starts with https://
const chromaClient = new ChromaClient({ host: CHROMA_HOST, port: CHROMA_PORT, ssl: CHROMA_SSL });

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
	// 1. Return from cache if the collection object is already available.
	if (_collectionCache.has(collectionName)) {
		// This log is now for a true cache hit, making it accurate.
		console.log(`[ChromaClient] Cache HIT for collection: ${collectionName}`);
		return _collectionCache.get(collectionName)!;
	}

	// 2. On a cache miss, get or create the collection from ChromaDB.
	console.log(`[ChromaClient] Cache MISS for ${collectionName}. Fetching or creating from DB...`);
	try {
		console.log(`[ChromaClient] Attempting to GET collection: ${collectionName}`);
		const collection = await chromaClient.getCollection({
			name: collectionName,
			embeddingFunction: embedFnOpenAi,
		});
		_collectionCache.set(collectionName, collection);
		console.log(`[ChromaClient] Cache HIT for existing collection: ${collectionName}`);
		return collection;
	} catch (error) {
		// Error means the collection does not exist, so we create it.
		// This is the new "get-or-create" pattern.
		console.log(`[ChromaClient] Collection ${collectionName} not found. Creating...`);
		const collection = await chromaClient.createCollection({
			name: collectionName,
			embeddingFunction: embedFnOpenAi,
			metadata: { name: collectionName, created: new Date().toString() },
		});
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
			`[ChromaClient.getDocumentsByMetadata] Fetching documents with filter: ${JSON.stringify(whereFilter)}`
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
		whereClause?: Where,
		limit?: number
	): Promise<ChromaResponse> => {
		try {
			console.log(
				`[ChromaClient.queryRecords] filter: ${JSON.stringify(whereClause)}, limit: ${limit}`
			);
			const MAX = await collection.count(); // Ensure the collection is initialized
			const results = await collection.get({
				include: [IncludeEnum.documents, IncludeEnum.metadatas],
				where: whereClause,
				limit: limit ?? MAX,
			});
			return _returnResponse(results);
		} catch (error) {
			console.error(`[ChromaClient.queryRecords] Failed to query records:`, error);
			throw new Error(
				`ChromaDB get failed for where ${JSON.stringify(whereClause)}: ${(error as Error).message}`
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
				`[ChromaClient.queryRecords] Querying with text: "${queryTexts.slice(0, 3)}...",\n filter: ${JSON.stringify(where)}, ${JSON.stringify(whereDocument)},\n limit: ${limit}`
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
			throw new Error(
				`ChromaDB get failed for queryText ${queryTexts.slice(0, 3)}: ${(error as Error).message}`
			);
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

	deleteRecordById: async (collection: Collection, id: string): Promise<void> => {
		return await collection.delete({ ids: [id] });
	},
};
