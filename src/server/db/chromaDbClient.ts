// src/server/db/chromaDbClient.ts
import { COLLECTIONS, MetadataType } from '#root/src/shared/domain/index.js';
import { ChromaResponse } from '#root/src/shared/index.js';
import { ChromaClient, Collection, IncludeEnum, GetResponse, Where, WhereDocument } from 'chromadb';

const CHROMA_URL = process.env.CHROMA_API_URL || 'https://chromadb-flyio.fly.dev';
const chromaClient = new ChromaClient({ path: CHROMA_URL });

/**
 * A centralized Map to cache all singleton Collection objects.
 * This avoids repetitive caching logic for each collection type.
 * Structure: Map<collectionName, Collection>
 */
const _collectionCache: Map<string, Collection> = new Map();

/**
 * A generic, caching helper for retrieving singleton collections.
 * It checks the cache first and only calls the DB if the collection object is not yet cached.
 * @param collectionName The name of the collection from the COLLECTIONS enum.
 * @returns A Promise that resolves to the ChromaDB Collection object.
 */
const _getOrCreateSingletonCollection = async (collectionName: string): Promise<Collection> => {
	// 1. Check the central cache first
	if (_collectionCache.has(collectionName)) {
		return _collectionCache.get(collectionName)!;
	}

	// 2. If not in cache (cache miss), fetch it from ChromaDB
	console.log(`[ChromaClient] Cache MISS for singleton collection: ${collectionName}. Creating...`);
	const collection = await chromaClient.getOrCreateCollection({
		name: collectionName,
		// The collection's metadata 'type' is set to its own name for consistency.
		metadata: { type: collectionName },
	});

	// 3. Store the new collection object in the cache for future requests
	_collectionCache.set(collectionName, collection);
	return collection;
};

const _returnResponse = (results: GetResponse | ChromaResponse): ChromaResponse => {
	const { ids, metadatas, documents } = results;
	if (!ids || ids.length === 0) {
		console.log(`[ChromaClient._returnResponse] No documents found for the query.`);
		return { ids: [], metadatas: [], documents: [] };
	}
	console.log(`[ChromaClient._returnResponse] Found ${ids.length} entries.`);
	return { ids, metadatas, documents };
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
				include: [IncludeEnum.Metadatas, IncludeEnum.Documents],
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
				include: [IncludeEnum.Documents, IncludeEnum.Metadatas], // Include IDs (implicit), documents, and metadatas
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
				include: [IncludeEnum.Documents, IncludeEnum.Metadatas],
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
				include: [IncludeEnum.Documents, IncludeEnum.Metadatas, IncludeEnum.Distances], // Also include distances
				where, // Pass the metadata filter
				whereDocument,
			});

			return results.ids
				.map((id, i) => {
					const ids = results.ids[i];
					const documents = results.documents[i];
					const metadatas = results.metadatas[i];
					return _returnResponse({ ids, documents, metadatas });
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
