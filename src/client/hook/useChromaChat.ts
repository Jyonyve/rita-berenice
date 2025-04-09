import { useState, useCallback, useMemo } from 'react';
import { ChromaClient, Collection, DefaultEmbeddingFunction, IncludeEnum } from 'chromadb';
import { ChatTurn, SUMMARY_ID_SUFFIX, SupportingAiModelList } from '#root/src/client/domain/index';

const chromaUrl = import.meta.env.VITE_CHROMA_API_URL as string;
const QUERY_LIMIT = import.meta.env.VITE_QUERY_LIMIT as number;

export const useChromaChat = (
	initialSessionId: string,
	initialAiModel: (typeof SupportingAiModelList)[number]
) => {
	const [sessionId, setSessionId] = useState(initialSessionId);
	const [aiModel, setAiModel] = useState(initialAiModel);

	// Memoize client to prevent recreation
	const client = useMemo(() => new ChromaClient({ path: chromaUrl }), []);

	// Memoize embedding function based on AI model
	const embeddingFunction = useMemo(
		() => new DefaultEmbeddingFunction({ model: aiModel }),
		[aiModel]
	);

	const getChatCollection = useCallback(async (): Promise<Collection> => {
		try {
			return await client.getOrCreateCollection({ name: sessionId, embeddingFunction });
		} catch (error) {
			console.error(`Failed to get chat collection for session ${sessionId}:`, error);
			throw error;
		}
	}, [client, sessionId, embeddingFunction]);

	const storeChatTurn = async (chatTurn: ChatTurn) => {
		const collection = await getChatCollection();
		const turnId = `${sessionId}_${chatTurn.sequence}`;

		await collection.add({
			ids: [turnId],
			documents: [JSON.stringify(chatTurn)],
			metadatas: [
				{ sequence: chatTurn.sequence, timestamp: chatTurn.request.timestamp, isTemp: chatTurn.isTemp },
			],
		});
	};

	/** 요약 저장 (덮어쓰기X, 업데이트O) */
	const storeSummary = async (newSummary: string) => {
		const collection = await getChatCollection();
		const summaryId = `${sessionId}${SUMMARY_ID_SUFFIX}`;
		const existingSummary = await getSummary();
		const updatedSummary = existingSummary ? `${existingSummary}\n---\n${newSummary}` : newSummary;

		await collection.add({
			ids: [summaryId],
			documents: [updatedSummary],
			metadatas: [{ timestamp: new Date().toISOString() }],
		});
	};

	// Keep memoization - used in other functions' dependency arrays
	const getSummary = useCallback(async (): Promise<string> => {
		const collection = await getChatCollection();
		const summaryId = `${sessionId}${SUMMARY_ID_SUFFIX}`;

		try {
			const results = await collection.query({ queryTexts: [summaryId], nResults: 1 });
			return results.documents?.[0]?.[0] || '';
		} catch (error) {
			console.warn(`No summary found for session ${sessionId}`);
			return '';
		}
	}, [sessionId, getChatCollection]);

	const queryChatLog = useCallback(
		async (queryText: string, limit: number = QUERY_LIMIT): Promise<string[]> => {
			const collection = await getChatCollection();
			try {
				const results = await collection.query({
					queryTexts: [queryText],
					nResults: limit,
					include: [IncludeEnum.Documents],
				});
				return results.documents?.[0]?.filter((doc): doc is string => doc !== null) || [];
			} catch (error) {
				console.error(`Failed to query chat log for session ${sessionId}:`, error);
				return [];
			}
		},
		[sessionId, getChatCollection]
	);

	const querySummary = useCallback(
		async (queryText: string): Promise<string[]> => {
			const collection = await getChatCollection();
			const summaryId = `${sessionId}${SUMMARY_ID_SUFFIX}`;

			try {
				const summary = await getSummary();
				if (summary && summary.length > 10) {
					const results = await collection.query({ queryTexts: [queryText], where: { id: summaryId } });
					return results.documents?.[0]?.filter((doc): doc is string => doc !== null) || [];
				}
				return [];
			} catch (error) {
				console.warn(`Failed to query summary for session ${sessionId}:`, error);
				return [];
			}
		},
		[sessionId, getSummary, getChatCollection]
	);

	const buildUserPromptFromLog = useCallback(
		async (userText: string, isFullLogQuery: boolean = false): Promise<string> => {
			if (!sessionId) throw new Error('No active session.');

			let relevantDetail = await querySummary(userText);
			if (!relevantDetail.length || isFullLogQuery) {
				relevantDetail = await queryChatLog(userText);
			}

			return `Context:\n${relevantDetail.join('\n')}\nUser Prompt: ${userText}`;
		},
		[sessionId, querySummary, queryChatLog]
	);

	return {
		sessionId,
		aiModel,
		setSessionId,
		setAiModel,
		getChatCollection,
		buildUserPromptFromLog,
		storeChatTurn,
		storeSummary,
		getSummary,
		queryChatLog,
		querySummary,
	};
};
