import { COLLECTIONS } from '#root/src/shared/domain/index.ts';
import { ChromaClient, Collection, IncludeEnum } from 'chromadb';

const CHROMA_URL = process.env.VITE_CHROMA_URL || 'http://localhost:8000';
const chromaClient = new ChromaClient({ path: CHROMA_URL });

// Collection caches
let characterCollection: Collection | null = null;
let profileCollection: Collection | null = null;
const sessionCollections: Record<string, Collection> = {};

export const chromaDbClient = {
	// Basic collection management
	getCharacterCollection: async (): Promise<Collection> => {
		if (!characterCollection) {
			characterCollection = await chromaClient.getOrCreateCollection({
				name: COLLECTIONS.CHARACTER,
				metadata: { type: 'character_list' },
			});
		}
		return characterCollection;
	},

	getProfileCollection: async (): Promise<Collection> => {
		if (!profileCollection) {
			profileCollection = await chromaClient.getOrCreateCollection({
				name: COLLECTIONS.PROFILE,
				metadata: { type: 'user_profiles' },
			});
		}
		return profileCollection;
	},

	getSessionCollection: async (sessionId: string): Promise<Collection> => {
		if (!sessionId) {
			throw new Error('Session ID is required');
		}

		if (!sessionCollections[sessionId]) {
			const characterName = sessionId.split('-')[0];
			sessionCollections[sessionId] = await chromaClient.getOrCreateCollection({
				name: `session_${sessionId}`,
				metadata: {
					type: 'chat_session',
					sessionId,
					characterName,
					createdAt: new Date().toISOString(),
				},
			});
		}
		return sessionCollections[sessionId];
	},

	// Enhanced CRUD operations with embedding support
	addDocument: async (
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

	upsertDocument: async (
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

	getDocumentById: async (collection: Collection, id: string): Promise<string | null> => {
		const result = await collection.get({ ids: [id], include: [IncludeEnum.Documents] });
		return result.documents?.[0] || null;
	},

	queryDocuments: async (
		collection: Collection,
		queryText: string,
		whereClause: Record<string, any>,
		limit: number
	): Promise<string[]> => {
		const results = await collection.query({
			queryTexts: [queryText],
			nResults: limit,
			include: [IncludeEnum.Documents],
			where: whereClause,
		});
		return results.documents?.[0]?.filter((doc): doc is string => doc !== null) || [];
	},

	// Add batch operations for efficiency
	addDocumentBatch: async (
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
};
