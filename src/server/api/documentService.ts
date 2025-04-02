import { Collection, IncludeEnum } from 'chromadb';
import type { ChatTurn } from '#root/src/client/domain/chat';
import chromaClient from '../chromadb';
import { SUMMARY_ID_SUFFIX } from '#root/src/client/domain/index';

const DEFAULT_QUERY_LIMIT = Number(process.env.VITE_QUERY_LIMIT) || 10;

export const documentService = {
	// Collection Management
	async getChatCollection(sessionId: string): Promise<Collection> {
		try {
			return await chromaClient.getOrCreateCollection({
				name: sessionId,
				metadata: { type: 'chat_history' },
			});
		} catch (error) {
			console.error(`Failed to get chat collection for session ${sessionId}:`, error);
			throw error;
		}
	},

	// Chat Turn Operations
	async storeChatTurn(sessionId: string, chatTurn: ChatTurn): Promise<void> {
		const collection = await this.getChatCollection(sessionId);
		const turnId = `${sessionId}_${chatTurn.sequence}`;

		await collection.add({
			ids: [turnId],
			documents: [JSON.stringify(chatTurn)],
			metadatas: [
				{ sequence: chatTurn.sequence, timestamp: chatTurn.request.timestamp, isTemp: chatTurn.isTemp },
			],
		});
	},

	// Summary Operations
	async storeSummary(sessionId: string, newSummary: string): Promise<void> {
		const collection = await this.getChatCollection(sessionId);
		const summaryId = `${sessionId}${SUMMARY_ID_SUFFIX}`;
		const existingSummary = await this.getSummary(sessionId);

		const updatedSummary = existingSummary ? `${existingSummary}\n---\n${newSummary}` : newSummary;

		await collection.add({
			ids: [summaryId],
			documents: [updatedSummary],
			metadatas: [{ timestamp: new Date().toISOString(), type: 'summary' }],
		});
	},

	async getSummary(sessionId: string): Promise<string> {
		const collection = await this.getChatCollection(sessionId);
		const summaryId = `${sessionId}${SUMMARY_ID_SUFFIX}`;

		try {
			const results = await collection.get({ ids: [summaryId], include: [IncludeEnum.Documents] });
			return results.documents?.[0]?.[0] || '';
		} catch (error) {
			console.warn(`No summary found for session ${sessionId}`);
			return '';
		}
	},

	// Query Operations
	async queryChatLog(
		sessionId: string,
		queryText: string,
		limit: number = DEFAULT_QUERY_LIMIT
	): Promise<string[]> {
		const collection = await this.getChatCollection(sessionId);
		try {
			const results = await collection.query({
				queryTexts: [queryText],
				nResults: limit,
				include: [IncludeEnum.Documents],
				where: { type: { $ne: 'summary' } },
			});
			return results.documents?.[0]?.filter((doc): doc is string => doc !== null) || [];
		} catch (error) {
			console.error(`Failed to query chat log for session ${sessionId}:`, error);
			return [];
		}
	},

	async querySummary(sessionId: string, queryText: string): Promise<string[]> {
		const collection = await this.getChatCollection(sessionId);
		const summaryId = `${sessionId}${SUMMARY_ID_SUFFIX}`;

		try {
			const summary = await this.getSummary(sessionId);
			if (!summary || summary.length <= 10) return [];

			const results = await collection.query({
				queryTexts: [queryText],
				where: { id: summaryId, type: 'summary' },
			});
			return results.documents?.[0]?.filter((doc): doc is string => doc !== null) || [];
		} catch (error) {
			console.warn(`Failed to query summary for session ${sessionId}:`, error);
			return [];
		}
	},

	async buildUserPromptFromLog(
		sessionId: string,
		userText: string,
		isFullLogQuery: boolean = false
	): Promise<string> {
		if (!sessionId) throw new Error('No active session.');

		// Try summary first unless full log is requested
		let relevantDetail: string[] = [];
		if (!isFullLogQuery) {
			relevantDetail = await this.querySummary(sessionId, userText);
		}

		// Fall back to full chat log if needed
		if (!relevantDetail.length || isFullLogQuery) {
			relevantDetail = await this.queryChatLog(sessionId, userText);
		}

		return relevantDetail.length
			? `Context:\n${relevantDetail.join('\n')}\nUser Prompt: ${userText}`
			: userText;
	},
};
