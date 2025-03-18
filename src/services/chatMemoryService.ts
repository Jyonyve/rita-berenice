import { v4 as uuidv4 } from 'uuid';
import { ChatSession, ChatTurn, ChatEntry } from '@domain/datasource';
import { createChromaService } from './chromaService';
import { parseTextToEntries } from '@utils/parseUtils';

const DEFAULT_QUERY_LIMIT = import.meta.env.VITE_DEFAULT_QUERY_LIMIT;
const RECENT_QUERY_LIMIT = import.meta.env.VITE_RECENT_QUERY_LIMIT;

export const createChatMemoryService = (apiUrl: string, openAiKey: string) => {
	let currentSession: ChatSession | null = null;

	return {
		startNewSession: async (characterName: string): Promise<string> => {
			// sessionId: characterName + uuid
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

			// 저장: 단일 대화 turn을 컬렉션에 추가
			await chromaService.addDocuments([
				{ id: `${currentSession.sessionId}-${timestamp}`, text, metadata: { speaker, timestamp } },
			]);

			// 하이브리드 접근: 3회 대화마다 요약 문서를 업데이트합니다.
			if (currentSession.conversation.length % RECENT_QUERY_LIMIT === 0) {
				await chromaService.addConversationContext({
					id: `${currentSession.sessionId}-${timestamp}`,
					context: text,
					timestamp,
				});
			}
		},

		buildPromptWithMemory: async (query: string): Promise<string> => {
			if (!currentSession) throw new Error('No active session.');

			const chromaService = createChromaService(apiUrl, currentSession.sessionId, openAiKey);
			// 세션 접두어로 summary 문서 id 구성 (예: "peter_uuid_summary")
			const sessionPrefix =
				currentSession.sessionId.split('_')[0] + currentSession.sessionId.split('_')[1];
			const summaryQueryText = `${sessionPrefix}_summary`;
			let summaryPrompt = '';
			try {
				const summaryResult = await chromaService.query(summaryQueryText, 1);
				summaryPrompt = summaryResult.documents.filter(Boolean).join('\n');
			} catch (error) {
				console.error('No summary available, proceeding without summary.');
			}

			// 전체 채팅 로그에서 관련 문서를 검색
			const fullLogResults = await chromaService.query(query, DEFAULT_QUERY_LIMIT);
			const fullLogPrompt = fullLogResults.documents.filter(Boolean).join('\n');

			return `Important Summary:\n${summaryPrompt}\n\nFull Conversation Context:\n${fullLogPrompt}\n\nUser: ${query}`;
		},

		getCurrentSession: (): ChatSession | null => currentSession,
	};
};
