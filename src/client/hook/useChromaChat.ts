import { useState, useCallback } from 'react';
import { SUFFIX, type ChatTurn } from '#root/src/client/domain/chat';
import { documentService } from '#root/src/server';

export const useChromaChat = (initialSessionId: string) => {
	const [sessionId, setSessionId] = useState(initialSessionId);

	const storeChatTurn = useCallback(
		async (chatTurn: ChatTurn) => {
			if (!sessionId) throw new Error('No active session.');
			await documentService.storeChatTurn(sessionId, chatTurn);
		},
		[sessionId]
	);

	const storeSummary = useCallback(
		async (summary: string) => {
			if (!sessionId) throw new Error('No active session.');
			await documentService.storeSummary(sessionId, summary);
		},
		[sessionId]
	);

	const getSummary = useCallback(async () => {
		if (!sessionId) throw new Error('No active session.');
		return (await documentService.getSummary(sessionId)) ?? '';
	}, [sessionId]);

	const querySummary = useCallback(
		async (query: string) => {
			if (!sessionId) throw new Error('No active session.');
			return (await documentService.querySummary(sessionId, query)).pop();
		},
		[sessionId]
	);

	const queryChatLog = useCallback(
		async (query: string, limit?: number, fixedOnly?: boolean) => {
			if (!sessionId) throw new Error('No active session.');
			return await documentService.queryChatLog(
				sessionId,
				query,
				['request', 'response'],
				fixedOnly ?? true
			);
		},
		[sessionId]
	);

	// For retrieving recent chat history
	const getRecentChatLogs = useCallback(
		async (turnCount?: number, fixedOnly?: boolean) => {
			if (!sessionId) throw new Error('No active session.');
			return await documentService.getRecentChatLogs(sessionId, turnCount, fixedOnly);
		},
		[sessionId]
	);

	const getChatTurnBySequence = useCallback(
		async (sequence: number, fixedOnly?: boolean) => {
			if (!sessionId) throw new Error('No active session.');
			return await documentService.getChatTurnBySequence(sessionId, sequence, fixedOnly);
		},
		[sessionId]
	);

	const getAllResponsesForSequence = useCallback(
		async (sequence: number, fixedOnly?: boolean) => {
			if (!sessionId) throw new Error('No active session.');
			return await documentService.getAllResponsesForSequence(sessionId, sequence, fixedOnly);
		},
		[sessionId]
	);

	const buildUserPromptFromLog = async (
		userText: string,
		isFullLogQuery?: boolean,
		fixedOnly: boolean = true
	) => {
		if (!sessionId) throw new Error('No active session.');
		return (
			(await documentService.buildUserPromptFromLog(sessionId, userText, isFullLogQuery, fixedOnly)) ??
			''
		);
	};

	return {
		sessionId,
		setSessionId,
		storeChatTurn,
		storeSummary,
		queryChatLog,
		querySummary,
		getSummary,
		getRecentChatLogs,
		getChatTurnBySequence,
		getAllResponsesForSequence,
		buildUserPromptFromLog,
	};
};
