import { ConversationContext, ChromaDocument, QueryResult } from '@domain/chromadb';
import { ChromaClient, Collection, OpenAIEmbeddingFunction, IncludeEnum } from 'chromadb';

const DEFAULT_QUERY_LIMIT = import.meta.env.VITE_DEFAULT_QUERY_LIMIT;
const RECENT_QUERY_LIMIT = import.meta.env.VITE_RECENT_QUERY_LIMIT;

const summarizeContexts = (contexts: ConversationContext[]): string => {
	return contexts.map((ctx) => ctx.context).join(' ');
};

export const chromaService = (apiUrl: string, collectionName: string, openAIApiKey: string) => {
	const client = new ChromaClient({ path: apiUrl });
	const embeddingFunction = new OpenAIEmbeddingFunction({ openai_api_key: openAIApiKey });
	let collection: Collection | null = null;

	const initializeCollection = async () => {
		if (collection) return;
		try {
			const collections = await client.listCollections();
			const exists = collections.some((col) => col === collectionName);
			collection = exists
				? await client.getCollection({ name: collectionName, embeddingFunction })
				: await client.createCollection({ name: collectionName, embeddingFunction });

			console.log(`Collection '${collectionName}' ${exists ? 'loaded' : 'created'} successfully`);
		} catch (error) {
			console.error('Failed to initialize ChromaDB connection:', error);
			throw error;
		}
	};

	const getRecentContexts = async (
		limit: number = RECENT_QUERY_LIMIT
	): Promise<ConversationContext[]> => {
		await initializeCollection();
		try {
			const results = await collection!.query({
				queryTexts: [''],
				nResults: limit,
				include: [IncludeEnum.Metadatas, IncludeEnum.Documents],
			});
			if (!results.documents?.[0]) return [];

			return results.documents[0]
				.map((doc, index) => ({
					id: results.ids?.[0]?.[index] || '',
					context: doc || '',
					timestamp: (results.metadatas?.[0]?.[index]?.timestamp as string) || '',
				}))
				.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
		} catch (error) {
			console.error('Failed to retrieve recent contexts:', error);
			return [];
		}
	};

	return {
		initialize: initializeCollection,

		addDocuments: async (documents: ChromaDocument[]): Promise<void> => {
			await initializeCollection();
			try {
				await collection!.add({
					ids: documents.map((doc) => doc.id),
					documents: documents.map((doc) => doc.text),
					metadatas: documents.map((doc) => doc.metadata || {}),
				});
				console.log(`Added ${documents.length} documents to collection`);
			} catch (error) {
				console.error('Failed to add documents:', error);
				throw error;
			}
		},

		query: async (queryText: string, n: number = DEFAULT_QUERY_LIMIT): Promise<QueryResult> => {
			await initializeCollection();
			try {
				const results = await collection!.query({ queryTexts: [queryText], nResults: n });
				if (!results.documents?.[0]) return { ids: [], documents: [], metadatas: [], distances: [] };

				return {
					ids: results.ids[0],
					documents: results.documents[0],
					metadatas: results.metadatas[0],
					distances: results.distances?.[0] ?? [],
				};
			} catch (error) {
				console.error('Failed to query collection:', error);
				throw error;
			}
		},

		deleteDocuments: async (ids: string[]): Promise<void> => {
			await initializeCollection();
			try {
				await collection!.delete({ ids });
				console.log(`Deleted ${ids.length} documents from collection`);
			} catch (error) {
				console.error('Failed to delete documents:', error);
				throw error;
			}
		},

		addConversationContext: async (context: ConversationContext): Promise<void> => {
			await initializeCollection();
			try {
				await collection!.add({
					ids: [context.id],
					documents: [context.context],
					metadatas: [{ timestamp: context.timestamp }],
				});
				console.log(`Added conversation context with id ${context.id}`);

				const sessionPrefix = context.id.split('_')[0];
				const summaryId = `${sessionPrefix}_summary`;

				const summaryResult = await collection!.query({ queryTexts: [summaryId], nResults: 1 });
				let summary = summaryResult.documents?.[0]?.[0] || '';

				const recentContexts = await getRecentContexts(3);
				if (recentContexts.length === 3) {
					const newSummary = summarizeContexts(recentContexts);
					summary = summary ? `${summary}\n${newSummary}` : newSummary;
				}

				await collection!.add({
					ids: [summaryId],
					documents: [summary],
					metadatas: [{ timestamp: new Date().toISOString() }],
				});
				console.log(`Updated summary with id ${summaryId}`);
			} catch (error) {
				console.error('Failed to add conversation context:', error);
				throw error;
			}
		},

		getRecentContexts,

		getCollection: (): Collection => {
			if (!collection) throw new Error('Collection not initialized. Call initialize() first.');
			return collection;
		},

		isInitialized: (): boolean => !!collection,
	};
};
