import { v4 as uuidv4 } from 'uuid';
import { ChatSession, ChatTurn, ChatEntry } from '@domain/datasource';
import { createChromaService } from './chromaService';
import { parseTextToEntries } from '@utils/parseUtils';

export const createChatMemoryService = (apiUrl: string, openAiKey: string) => {
	let currentSession: ChatSession | null = null;

	return {
		startNewSession: async (characterName: string): Promise<string> => {
			const sessionId = `${characterName}_${uuidv4()}`;
			currentSession = { sessionId, conversation: [] };
			const chromaService = createChromaService(apiUrl, sessionId, openAiKey);
			await chromaService.initialize();
			return sessionId;
		},

		addChatTurn: async (speaker: string, text: string): Promise<void> => {
			if (!currentSession) throw new Error('No active session.');

			const timestamp = new Date().toISOString();
			const entries: ChatEntry[] = parseTextToEntries(text);

			const turn: ChatTurn = { speaker, entries, timestamp };
			currentSession.conversation.push(turn);
			const chromaService = createChromaService(apiUrl, currentSession.sessionId, openAiKey);
			await chromaService.addDocuments([
				{ id: `${currentSession.sessionId}-${timestamp}`, text, metadata: { speaker, timestamp } },
			]);
		},

		buildPromptWithMemory: async (query: string): Promise<string> => {
			if (!currentSession) throw new Error('No active session.');
			const chromaService = createChromaService(apiUrl, currentSession.sessionId, openAiKey);
			const results = await chromaService.query(query, 5);
			return `Previous context:\n${results.documents.filter(Boolean).join('\n')}\nUser: ${query}`;
		},

		getCurrentSession: (): ChatSession | null => currentSession,
	};
};
