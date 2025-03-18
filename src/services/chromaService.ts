import { ConversationContext, ChromaDocument, QueryResult } from '@domain/chromadb';
import { ChromaClient, Collection, OpenAIEmbeddingFunction, IncludeEnum } from 'chromadb';

const DEFAULT_QUERY_LIMIT = import.meta.env.VITE_DEFAULT_QUERY_LIMIT;
const RECENT_QUERY_LIMIT = import.meta.env.VITE_RECENT_QUERY_LIMIT;

// 더 정교한 요약 로직이 필요하다면 LLM 호출이나 기타 요약 알고리즘으로 대체할 수 있습니다.
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

	const getRecentContexts = async (limit: number = 10): Promise<ConversationContext[]> => {
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
			if (!collection) throw new Error('Collection not initialized. Call initialize() first.');
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

		query: async (queryText: string, n: number = DEFAULT_QUERY_LIMIT): Promise<QueryResult> => {
			if (!collection) throw new Error('Collection not initialized. Call initialize() first.');
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
			if (!collection) throw new Error('Collection not initialized. Call initialize() first.');
			try {
				await collection.delete({ ids });
				console.log(`Deleted ${ids.length} documents from collection`);
			} catch (error) {
				console.error('Failed to delete documents:', error);
				throw error;
			}
		},

		addConversationContext: async (context: ConversationContext): Promise<void> => {
			if (!collection) throw new Error('Collection not initialized. Call initialize() first.');
			try {
				// 원본 대화 문서를 저장합니다.
				await collection.add({
					ids: [context.id],
					documents: [context.context],
					metadatas: [{ timestamp: context.timestamp }],
				});
				console.log(`Added conversation context with id ${context.id}`);

				// session prefix 기반 summary 문서 id 구성 (예: "peter_summary")
				const sessionPrefix = context.id.split('_')[0];
				const summaryId = `${sessionPrefix}_summary`;

				// 기존 summary를 검색합니다.
				const summaryResult = await collection.query({ queryTexts: [summaryId], nResults: 1 });
				let summary = summaryResult.documents?.[0]?.[0] || '';

				// 최근 3개의 문서를 가져와 요약합니다.
				const recentContexts = await getRecentContexts(3);
				if (recentContexts.length === 3) {
					const newSummary = summarizeContexts(recentContexts);
					summary = summary ? summary + `\n${newSummary}` : newSummary;
				}

				// summary 문서를 저장 또는 업데이트합니다.
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
			if (!collection) throw new Error('Collection not initialized. Call initialize() first.');
			return collection;
		},

		isInitialized: (): boolean => !!collection,
	};
};
