import { useState, useCallback } from 'react';
import type { ChatTurn } from '#root/src/client/domain/chat';
import { documentService } from '#root/src/server';

export const useChromaChat = (initialSessionId: string) => {
	const [sessionId, setSessionId] = useState(initialSessionId);

	const storeChatTurn = useCallback(
		async (chatTurn: ChatTurn) => {
			if (!sessionId) throw new Error('No active session.');
			await documentService.addChatTurn(sessionId, chatTurn);
		},
		[sessionId]
	);

	const storeSummary = useCallback(
		async (summary: string) => {
			if (!sessionId) throw new Error('No active session.');
			await documentService.addSummary(sessionId, summary);
		},
		[sessionId]
	);

	const getSummary = useCallback(async () => {
		if (!sessionId) throw new Error('No active session.');
		return (await documentService.getSummary(sessionId)) ?? '';
	}, [sessionId]);

	const queryChatLog = useCallback(
		async (query: string, limit?: number) => {
			if (!sessionId) throw new Error('No active session.');
			return await documentService.queryChatLog(sessionId, query, limit ?? 10);
		},
		[sessionId]
	);

	return { sessionId, setSessionId, storeChatTurn, storeSummary, getSummary, queryChatLog };
};
