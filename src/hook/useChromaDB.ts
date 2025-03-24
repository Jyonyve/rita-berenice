import { useState } from 'react';
import { ChromaClient, Collection, DefaultEmbeddingFunction, IncludeEnum } from 'chromadb';
import { ChatTurn } from '@domain/chat';
import { AiModelInfo } from '@domain/aimodel';

const chromaUrl = import.meta.env.VITE_CHROMA_API_URL as string;
const QUERY_LIMIT = import.meta.env.VITE_QUERY_LIMIT as number;
const SUMMARY_ID_SUFFIX = '_summary';

export const useChromaDB = (sessionId: string, aiModelInfo: AiModelInfo) => {
	const [client] = useState(() => new ChromaClient({ path: chromaUrl }));
	const embeddingFunction = new DefaultEmbeddingFunction({ model: aiModelInfo.model });

	/** 특정 세션(`sessionId`)에 대한 컬렉션 가져오기 */
	const getCollection = async (sessionId: string): Promise<Collection> => {
		try {
			const collections = await client.listCollections();
			const exists = collections.some((col) => col === sessionId);
			return exists
				? await client.getCollection({ name: sessionId, embeddingFunction })
				: await client.createCollection({ name: sessionId });
		} catch (error) {
			console.error(`Failed to get collection for session ${sessionId}:`, error);
			throw error;
		}
	};

	/** 채팅 로그 저장 */
	const storeChatTurn = async (sessionId: string, chatTurn: ChatTurn) => {
		const collection = await getCollection(sessionId);
		const turnId = `${sessionId}_${chatTurn.sequence}`;

		await collection.add({
			ids: [turnId],
			documents: [JSON.stringify(chatTurn)], // ChatTurn 전체를 JSON 문자열로 저장
			metadatas: [
				{ sequence: chatTurn.sequence, timestamp: chatTurn.request.timestamp, isTemp: chatTurn.isTemp },
			],
		});

		console.log(`Stored chat turn ${turnId}`);
	};

	/** 요약 저장 (덮어쓰기X, 업데이트O) */
	const storeSummary = async (sessionId: string, newSummary: string) => {
		const collection = await getCollection(sessionId);
		const summaryId = `${sessionId}${SUMMARY_ID_SUFFIX}`;

		// 기존 요약 가져오기
		const existingSummary = await getSummary(sessionId);

		// 기존 요약과 새로운 요약 합치기 (구분자 "\n---\n" 추가)
		const updatedSummary = existingSummary ? `${existingSummary}\n---\n${newSummary}` : newSummary;

		// 기존 요약을 삭제하지 않고 업데이트
		await collection.add({
			ids: [summaryId],
			documents: [updatedSummary],
			metadatas: [{ timestamp: new Date().toISOString() }],
		});

		console.log(`Updated summary for ${summaryId}`);
	};

	/** 요약 조회 */
	const getSummary = async (sessionId: string): Promise<string> => {
		const collection = await getCollection(sessionId);
		const summaryId = `${sessionId}${SUMMARY_ID_SUFFIX}`;

		try {
			const results = await collection.query({ queryTexts: [summaryId], nResults: 1 });
			return results.documents?.[0]?.[0] || '';
		} catch (error) {
			console.warn(`No summary found for session ${sessionId}`);
			return '';
		}
	};

	/** 유사한 채팅 로그 검색 */
	const queryChatLog = async (
		sessionId: string,
		queryText: string,
		limit: number = QUERY_LIMIT
	): Promise<string[]> => {
		const collection = await getCollection(sessionId);
		let result: string[] = [];
		try {
			const results = await collection.query({
				queryTexts: [queryText],
				nResults: limit,
				include: [IncludeEnum.Documents],
			});
			result = results.documents?.[0]?.filter((doc): doc is string => doc !== null) || [];
		} catch (error) {
			console.error(`Failed to query chat log for session ${sessionId}:`, error);
		}
		return result;
	};

	/** 요약 문서에서 유사한 내용 검색 */
	const querySummary = async (sessionId: string, queryText: string): Promise<string[]> => {
		const collection = await getCollection(sessionId);
		const summaryId = `${sessionId}${SUMMARY_ID_SUFFIX}`;
		let result: string[] = [];

		try {
			// Get the full summary document first
			const summary = await getSummary(sessionId);
			if (summary && summary.length > 10) {
				// Use ChromaDB to find similar sections
				const results = await collection.query({
					queryTexts: [queryText],
					where: { id: summaryId }, // Only search within the summary document
				});
				result = results.documents?.[0]?.filter((doc): doc is string => doc !== null) || [];
			}
		} catch (error) {
			console.warn(`Failed to query summary for session ${sessionId}:`, error);
		}
		return result;
	};

	// Update buildUserPromptFromLog to use querySummary
	const buildUserPromptFromLog = async (
		userText: string,
		isFull: boolean = false
	): Promise<string> => {
		if (!sessionId) throw new Error('No active session.');

		// 요약 조회
		let relevantDetail = await querySummary(sessionId, userText);

		// 요약이 충분하지 않다면 전체 로그 검색 수행
		if (!relevantDetail.length || isFull) {
			const chatLogs = await queryChatLog(sessionId, userText);
			relevantDetail = chatLogs;
		}

		// 프롬프트 조합
		return `Context:\n${relevantDetail.join('\n')}\nUser Prompt: ${userText}`;
	};

	return { buildUserPromptFromLog, storeChatTurn, storeSummary, getSummary, queryChatLog };
};
