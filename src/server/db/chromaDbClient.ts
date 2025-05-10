import {
	COLLECTIONS,
	CollectionType,
	METADATA_TYPES,
	MetadataType,
} from '#root/src/shared/domain/index.ts';
import { DEFAULT_QUERY_LIMIT } from '#root/src/shared/index.ts';
import { ChromaClient, Collection, IncludeEnum, Metadata, GetResponse, Where } from 'chromadb';

const CHROMA_URL = process.env.CHROMA_API_URL || 'http://localhost:8000';
const chromaClient = new ChromaClient({ path: CHROMA_URL });

// Collection caches
const sessionCollections: Record<string, Collection> = {};
let characterCollection: Collection | null = null;
let profileCollection: Collection | null = null;
let credentialCollection: Collection | null = null;
let tempChatCollection: Collection | null = null;
let recapCollection: Collection | null = null;
export type ChromaResponse = Pick<GetResponse, 'ids' | 'metadatas' | 'documents'>;
const _returnResponse = (results: ChromaResponse) => {
	const { ids } = results;

	if (!ids || ids.length === 0) {
		console.log(`[ChromaClient.queryRecords] No documents found for the query.`);
		return null;
	}
	console.log(`[ChromaClient.queryRecords] Found ${ids.length} entries.`);
	return results;
};

export const chromaDbClient = {
	// Basic collection management
	getCredentialCollection: async (): Promise<Collection> => {
		if (!credentialCollection) {
			credentialCollection = await chromaClient.getOrCreateCollection({
				// Use a consistent name for the secrets collection
				name: COLLECTIONS.CREDENTIAL,
				metadata: { type: COLLECTIONS.CREDENTIAL },
			});
		}
		return credentialCollection;
	},

	getCharacterCollection: async (): Promise<Collection> => {
		if (!characterCollection) {
			characterCollection = await chromaClient.getOrCreateCollection({
				name: COLLECTIONS.CHARACTER,
				metadata: { type: COLLECTIONS.CHARACTER },
			});
		}
		return characterCollection;
	},

	getProfileCollection: async (): Promise<Collection> => {
		if (!profileCollection) {
			profileCollection = await chromaClient.getOrCreateCollection({
				name: COLLECTIONS.PROFILE,
				metadata: { type: COLLECTIONS.PROFILE },
			});
		}
		return profileCollection;
	},

	getTempChatCollection: async (): Promise<Collection> => {
		if (!tempChatCollection) {
			tempChatCollection = await chromaClient.getOrCreateCollection({
				name: COLLECTIONS.TEMP_CHAT,
				metadata: { type: COLLECTIONS.TEMP_CHAT },
			});
		}
		return tempChatCollection;
	},

	getRecapCollection: async (): Promise<Collection> => {
		if (!recapCollection) {
			recapCollection = await chromaClient.getOrCreateCollection({
				name: COLLECTIONS.RECAP,
				metadata: { type: COLLECTIONS.RECAP },
			});
		}
		return recapCollection;
	},

	getLoreCollection: async (): Promise<Collection> => {
		if (!recapCollection) {
			recapCollection = await chromaClient.getOrCreateCollection({
				name: COLLECTIONS.LORE,
				metadata: { type: COLLECTIONS.LORE },
			});
		}
		return recapCollection;
	},

	getSessionCollection: async (sessionId: string): Promise<Collection> => {
		if (!sessionId) {
			throw new Error('Session ID is required');
		}

		if (!sessionCollections[sessionId]) {
			const characterName = sessionId.split('-')[0];
			sessionCollections[sessionId] = await chromaClient.getOrCreateCollection({
				name: COLLECTIONS.CHAT,
				metadata: {
					type: COLLECTIONS.CHAT,
					sessionId,
					characterName,
					createdAt: new Date().toISOString(),
				},
			});
		}
		return sessionCollections[sessionId];
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

	getRecordById: async (collection: Collection, id: string): Promise<GetResponse> => {
		const result = await collection.get({ ids: [id], include: [IncludeEnum.Metadatas] });
		return result;
	},

	getRecordsByMetadataType: async (
		collection: Collection,
		type: MetadataType,
		options: { offset?: number; limit?: number } = {}
	): Promise<ChromaResponse | null> => {
		const whereFilter: Where = { type: { $eq: type } }; // For just type

		console.log(
			`[ChromaClient.getDocumentsByMetadata] Fetching documents with filter: ${JSON.stringify(whereFilter)}`
		);

		try {
			const results = await collection.get({
				where: whereFilter,
				include: [IncludeEnum.Documents, IncludeEnum.Metadatas], // Include IDs (implicit), documents, and metadatas
				offset: options.offset,
				limit: options.limit,
			});

			return _returnResponse(results);
		} catch (error) {
			console.error(
				`[ChromaClient.getDocumentsByMetadata] Error fetching documents by metadata type:`,
				error
			);
			return null;
		}
	},

	getRecords: async (
		collection: Collection,
		whereClause?: Where,
		limit: number = DEFAULT_QUERY_LIMIT
	): Promise<ChromaResponse | null> => {
		try {
			console.log(
				`[ChromaClient.queryRecords] filter: ${JSON.stringify(whereClause)}, limit: ${limit}`
			);
			const results = await collection.get({
				include: [IncludeEnum.Documents, IncludeEnum.Metadatas],
				where: whereClause,
				limit,
			});
			return _returnResponse(results);
		} catch (error) {
			console.error(`[ChromaClient.queryRecords] Failed to query records:`, error);
			return null;
		}
	},

	queryRecords: async (
		collection: Collection,
		queryText: string,
		whereClause?: Where,
		limit: number = DEFAULT_QUERY_LIMIT
	): Promise<ChromaResponse[]> => {
		try {
			console.log(
				`[ChromaClient.queryRecords] Querying with text: "${queryText.substring(0, 50)}...", filter: ${JSON.stringify(whereClause)}, limit: ${limit}`
			);
			const results = await collection.query({
				queryTexts: [queryText], // queryTexts expects an array of strings
				nResults: limit,
				include: [IncludeEnum.Documents, IncludeEnum.Metadatas, IncludeEnum.Distances], // Also include distances
				where: whereClause, // Pass the metadata filter
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
			return [];
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
