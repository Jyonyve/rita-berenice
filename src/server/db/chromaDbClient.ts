import { COLLECTIONS } from '#root/src/shared/domain/index.ts';
import { ChromaClient, Collection, IncludeEnum } from 'chromadb';

const CHROMA_URL = process.env.CHROMA_API_URL || 'http://localhost:8000';
const chromaClient = new ChromaClient({ path: CHROMA_URL });

// Collection caches
const sessionCollections: Record<string, Collection> = {};
let characterCollection: Collection | null = null;
let profileCollection: Collection | null = null;
let credentialCollection: Collection | null = null;
let tempChatCollection: Collection | null = null;
let recapCollection: Collection | null = null;

export const chromaDbClient = {
	// Basic collection management
	getCredentialCollection: async (): Promise<Collection> => {
		if (!credentialCollection) {
			credentialCollection = await chromaClient.getOrCreateCollection({
				// Use a consistent name for the secrets collection
				name: COLLECTIONS.CREDENTIAL,
				metadata: { type: 'credential' },
			});
		}
		return credentialCollection;
	},

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

	getTempChatCollection: async (): Promise<Collection> => {
		if (!tempChatCollection) {
			tempChatCollection = await chromaClient.getOrCreateCollection({
				name: COLLECTIONS.TEMP_CHAT,
				metadata: { type: 'recent_temp_chat' },
			});
		}
		return tempChatCollection;
	},

	getRecapCollection: async (): Promise<Collection> => {
		if (!recapCollection) {
			recapCollection = await chromaClient.getOrCreateCollection({
				name: COLLECTIONS.RECAP,
				metadata: { type: 'conversation_recap' },
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

	deleteDocumentById: async (collection: Collection, id: string): Promise<void> => {
		return await collection.delete({ ids: [id] });
	},
};
