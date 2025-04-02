import { ChromaClient, Collection } from 'chromadb';
import type { ChatTurn } from '#root/src/client/domain/chat';

const CHROMA_URL = process.env.VITE_CHROMA_URL || 'http://localhost:8000';

type CollectionType = 'document' | 'character';
const chromaClient = new ChromaClient({ path: CHROMA_URL });
const collections: { [K in CollectionType]?: Collection } = {};

const chromaCollections = {
	async getDocumentCollection(): Promise<Collection> {
		if (!collections.document) {
			collections.document = await chromaClient.getOrCreateCollection({
				name: 'document',
				metadata: { type: 'chat_history' },
			});
		}
		return collections.document;
	},

	async getCharacterCollection(): Promise<Collection> {
		if (!collections.CHARACTER) {
			collections.CHARACTER = await chromaClient.getOrCreateCollection({
				name: COLLECTION_NAMES.CHARACTER,
				metadata: { type: 'character_info' } satisfies CollectionMetadata['CHARACTER'],
			});
		}
		return collections.CHARACTER;
	},
};

export default chromaCollections;
