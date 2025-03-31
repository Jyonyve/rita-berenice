import { ChatTurn } from '#root/src/client/domain/chat';
import { ConversationContext, ChromaDocument, QueryResult } from '#root/src/client/domain/chromadb';
import { useAiModel } from '#root/src/client/hook/useAiModel';
import { useChromaChat } from '#root/src/client/hook/useChromaChat';
import { ChromaClient, Collection, OpenAIEmbeddingFunction, IncludeEnum } from 'chromadb';
export const ChromaComp = (sessionId: string, chatTurn: ChatTurn) => {
	const { aiModelInfo } = useAiModel();
	const { storeChatTurn, storeSummary, getSummary, queryChatLog } = useChromaChat(
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
