import { ConversationContext, ChromaDocument, QueryResult } from '@domain/chromadb';
import { ChromaClient, Collection, OpenAIEmbeddingFunction, IncludeEnum } from 'chromadb';

// Summarization function (dummy implementation, replace with actual summarization logic)
const summarizeContexts = (contexts: ConversationContext[]): string => {
	return contexts.map((ctx) => ctx.context).join(' ');
};

export const createChromaService = (
	apiUrl: string,
	collectionName: string,
	openAIApiKey: string
) => {
	const client = new ChromaClient({ path: apiUrl });
	const embeddingFunction = new OpenAIEmbeddingFunction({ openai_api_key: openAIApiKey });
	let collection: Collection | null = null;

	const getRecentContexts = async (limit: number = 5): Promise<ConversationContext[]> => {
		if (!collection) {
			throw new Error('Collection not initialized. Call initialize() first.');
		}

		try {
			const results = await collection.query({
				queryTexts: [''],
				nResults: limit,
				include: [IncludeEnum.Metadatas, IncludeEnum.Documents],
			});
			const contexts =
				results.documents?.[0]?.map((doc, index) => ({
					id: results.ids?.[0]?.[index] || '',
					context: doc || '',
					timestamp: (results.metadatas?.[0]?.[index]?.timestamp as string) || '',
				})) || [];

			// Sort contexts by timestamp in descending order
			contexts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

			return contexts;
		} catch (error) {
			console.error('Failed to retrieve recent contexts:', error);
			throw error;
		}
	};

	return {
		initialize: async (): Promise<void> => {
			try {
				const collections = await client.listCollections();
				const exists = collections.some((col) => col === collectionName);

				if (exists) {
					collection = await client.getCollection({ name: collectionName, embeddingFunction });
					console.log(`Collection '${collectionName}' loaded successfully`);
				} else {
					collection = await client.createCollection({ name: collectionName, embeddingFunction });
					console.log(`Collection '${collectionName}' created successfully`);
				}
			} catch (error) {
				console.error('Failed to initialize ChromaDB connection:', error);
				throw error;
			}
		},

		addDocuments: async (documents: ChromaDocument[]): Promise<void> => {
			if (!collection) {
				throw new Error('Collection not initialized. Call initialize() first.');
			}

			try {
				await collection.add({
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

		query: async (queryText: string, n: number = 5): Promise<QueryResult> => {
			if (!collection) {
				throw new Error('Collection not initialized. Call initialize() first.');
			}

			try {
				const results = await collection.query({ queryTexts: [queryText], nResults: n });
				const { ids, distances, documents, metadatas } = results;
				return {
					ids: ids[0],
					documents: documents[0],
					metadatas: metadatas[0],
					distances: distances?.[0] ?? [],
				};
			} catch (error) {
				console.error('Failed to query collection:', error);
				throw error;
			}
		},

		deleteDocuments: async (ids: string[]): Promise<void> => {
			if (!collection) {
				throw new Error('Collection not initialized. Call initialize() first.');
			}

			try {
				await collection.delete({ ids });
				console.log(`Deleted ${ids.length} documents from collection`);
			} catch (error) {
				console.error('Failed to delete documents:', error);
				throw error;
			}
		},

		addConversationContext: async (context: ConversationContext): Promise<void> => {
			if (!collection) {
				throw new Error('Collection not initialized. Call initialize() first.');
			}

			try {
				// Add raw conversation context
				await collection.add({
					ids: [context.id],
					documents: [context.context],
					metadatas: [{ timestamp: context.timestamp }],
				});
				console.log(`Added conversation context with id ${context.id}`);

				// Retrieve the existing summary
				const summaryId = `${context.id.split('_')[0]}_summary`;
				const summaryResult = await collection.query({ queryTexts: [summaryId], nResults: 1 });
				let summary = summaryResult.documents?.[0]?.[0] || '';

				// Update the summary with the new context
				const recentContexts = await getRecentContexts(3);
				if (recentContexts.length === 3) {
					const newSummary = summarizeContexts(recentContexts);
					summary += `\n${newSummary}`;
				}

				// Store the updated summary
				await collection.add({
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
			if (!collection) {
				throw new Error('Collection not initialized. Call initialize() first.');
			}
			return collection;
		},

		isInitialized: (): boolean => {
			return !!collection;
		},
	};
};
