import { ChatTurn } from '@domain/chat';
import { ConversationContext, ChromaDocument, QueryResult } from '@domain/chromadb';
import { useAiModel } from '@hook/useAiModel';
import { useChromaDB } from '@hook/useChromaDB';
import { ChromaClient, Collection, OpenAIEmbeddingFunction, IncludeEnum } from 'chromadb';
export const ChromaComp = (sessionId: string, chatTurn: ChatTurn) => {
	const { aiModelInfo } = useAiModel();
	const { storeChatTurn, storeSummary, getSummary, queryChatLog } = useChromaDB(
		sessionId,
		aiModelInfo
	);

	const handleSaveChatTurn = async () => {
		await storeChatTurn(sessionId, chatTurn);
	};

	const handleSaveSummary = async (summary: string) => {
		await storeSummary(sessionId, summary);
	};
};
