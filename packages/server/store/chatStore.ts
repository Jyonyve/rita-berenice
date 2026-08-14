import { and, asc, eq, inArray, lt } from 'drizzle-orm';
import { ChatResponse, Metadata } from '@rita-berenice/shared/api';
import { ChatTurn, DisplayTurn } from '@rita-berenice/shared/domain';
import { buildChatTurnId, chatTurnToMetadata } from '@rita-berenice/shared/util';
import { getDatabase } from '../db/postgresClient.js';
import { chatTurns as chatTurnTable } from '../db/schema.js';
import {
	deleteMemoryEmbeddings,
	QueryEmbeddingCache,
	searchMemoryEmbeddingsByKeywords,
	searchMemoryEmbeddings,
} from '../service/embeddingService.js';
import { embeddingJobService } from '../service/embeddingJobService.js';
import { chatTurnToDocument } from '../util/documentUtils.js';
import { RagTraceContext } from '../util/ragTraceUtils.js';
import { FilterCriteria } from '../util/schemaUtils.js';

const emptyResponse = (): ChatResponse => ({
	ids: [],
	documents: [],
	metadatas: [],
	chatTurns: [],
	displayTurns: [],
});

const toDisplayTurn = (turn: ChatTurn): DisplayTurn => ({
	chatTurnId: turn.chatTurnId,
	sessionId: turn.sessionId,
	characterId: turn.characterId,
	userId: turn.userId,
	profileId: turn.profileId,
	sequence: turn.sequence,
	createdAt: turn.createdAt,
	updatedAt: turn.updatedAt,
	request: turn.request,
	response: turn.response,
});

const toResponse = (items: ChatTurn[], displayOnly = false): ChatResponse => ({
	ids: items.map((item) => item.chatTurnId),
	documents: items.map(chatTurnToDocument),
	metadatas: items.map((item) => chatTurnToMetadata(item) as unknown as Metadata),
	chatTurns: displayOnly ? [] : items,
	displayTurns: items.map(toDisplayTurn),
});

const matchesCriteria = (turn: ChatTurn, criteria?: FilterCriteria) => {
	if (!criteria) return true;
	const searchable = [
		...(turn.keywordList ?? []),
		...(turn.topicList ?? []),
		...(turn.entityList ?? []),
		...(turn.flagList ?? []),
		turn.userEmotion?.primary,
		turn.characterEmotion?.primary,
	]
		.filter(Boolean)
		.map((value) => String(value).toLowerCase());
	const requested = [
		...(criteria.keywords ?? []),
		...(criteria.topics ?? []),
		...(criteria.entities?.characters ?? []),
		...(criteria.entities?.locations ?? []),
		...(criteria.entities?.items ?? []),
		criteria.emotion,
	]
		.filter(Boolean)
		.map((value) => String(value).toLowerCase());
	return requested.length === 0 || requested.some((value) => searchable.includes(value));
};

const upsertTurn = async (turn: ChatTurn): Promise<void> => {
	const now = new Date().toISOString();
	await getDatabase()
		.insert(chatTurnTable)
		.values({
			chatTurnId: turn.chatTurnId,
			sessionId: turn.sessionId,
			characterId: turn.characterId,
			profileId: turn.profileId,
			userId: turn.userId,
			sequence: turn.sequence,
			data: turn,
			createdAt: turn.createdAt || now,
			updatedAt: turn.updatedAt || now,
		})
		.onConflictDoUpdate({
			target: chatTurnTable.chatTurnId,
			set: {
				sessionId: turn.sessionId,
				characterId: turn.characterId,
				profileId: turn.profileId,
				userId: turn.userId,
				sequence: turn.sequence,
				data: turn,
				updatedAt: turn.updatedAt || now,
			},
		});
	embeddingJobService.enqueue({
		sourceType: 'chat',
		sourceId: turn.chatTurnId,
		userId: turn.userId,
		characterId: turn.characterId,
		sessionId: turn.sessionId,
		content: chatTurnToDocument(turn),
		metadata: chatTurnToMetadata(turn) as unknown as Metadata,
	});
};

export const chatStore = {
	storeChatTurn: async (turn: ChatTurn): Promise<{ chatTurnId: string }> => {
		await upsertTurn(turn);
		return { chatTurnId: turn.chatTurnId };
	},

	storeChatTurns: async (turns: ChatTurn[]): Promise<void> => {
		for (const turn of turns) await upsertTurn(turn);
	},

	getChatTurn: async (chatTurnId: string): Promise<ChatResponse> => {
		const row = await getDatabase().query.chatTurns.findFirst({
			where: eq(chatTurnTable.chatTurnId, chatTurnId),
		});
		return row ? toResponse([row.data]) : emptyResponse();
	},

	hasChatTurn: async (chatTurnId: string): Promise<boolean> => {
		const row = await getDatabase()
			.select({ id: chatTurnTable.chatTurnId })
			.from(chatTurnTable)
			.where(eq(chatTurnTable.chatTurnId, chatTurnId))
			.limit(1);
		return row.length > 0;
	},

	getAllChatTurns: async (sessionId: string): Promise<ChatResponse> => {
		const rows = await getDatabase()
			.select({ data: chatTurnTable.data })
			.from(chatTurnTable)
			.where(eq(chatTurnTable.sessionId, sessionId))
			.orderBy(asc(chatTurnTable.sequence));
		return toResponse(rows.map((row) => row.data));
	},

	getAllDisplayTurns: async (sessionId: string): Promise<ChatResponse> => {
		const response = await chatStore.getAllChatTurns(sessionId);
		return { ...response, chatTurns: [] };
	},

	getDisplayTurnsBeforeSequence: async (
		sessionId: string,
		beforeSequence: number
	): Promise<ChatResponse> => {
		const rows = await getDatabase()
			.select({ data: chatTurnTable.data })
			.from(chatTurnTable)
			.where(and(eq(chatTurnTable.sessionId, sessionId), lt(chatTurnTable.sequence, beforeSequence)))
			.orderBy(asc(chatTurnTable.sequence));
		return toResponse(
			rows.map((row) => row.data),
			true
		);
	},

	getChatTurnBySequence: async (sessionId: string, sequence: number): Promise<ChatResponse> => {
		const row = await getDatabase().query.chatTurns.findFirst({
			where: and(eq(chatTurnTable.sessionId, sessionId), eq(chatTurnTable.sequence, sequence)),
		});
		return row ? toResponse([row.data]) : emptyResponse();
	},

	getChatTurnsBySequences: async (sessionId: string, sequences: number[]): Promise<ChatResponse> => {
		const uniqueSequences = [...new Set(sequences)];
		if (!uniqueSequences.length) return emptyResponse();

		const rows = await getDatabase()
			.select({ data: chatTurnTable.data })
			.from(chatTurnTable)
			.where(
				and(eq(chatTurnTable.sessionId, sessionId), inArray(chatTurnTable.sequence, uniqueSequences))
			)
			.orderBy(asc(chatTurnTable.sequence));
		return toResponse(rows.map((row) => row.data));
	},

	queryChatTurns: async (
		sessionId: string,
		queryTexts: string[],
		filterCriteria?: FilterCriteria,
		_whereDocument?: unknown,
		limit = 10,
		queryEmbeddingCache?: QueryEmbeddingCache,
		ragTraceContext?: RagTraceContext
	): Promise<ChatResponse> => {
		const rows = await getDatabase()
			.select({ data: chatTurnTable.data })
			.from(chatTurnTable)
			.where(eq(chatTurnTable.sessionId, sessionId));
		const candidates = rows
			.map((row) => row.data)
			.filter((turn) => matchesCriteria(turn, filterCriteria));
		if (!candidates.length) return emptyResponse();
		const queryWithEmotion = filterCriteria?.emotion
			? [...queryTexts, `conversation with ${filterCriteria.emotion} emotion`]
			: queryTexts;
		const results = await searchMemoryEmbeddings(
			queryWithEmotion,
			{ sourceType: 'chat', sessionId, sourceIds: candidates.map((turn) => turn.chatTurnId) },
			limit,
			queryEmbeddingCache,
			ragTraceContext
		);
		const byId = new Map(candidates.map((turn) => [turn.chatTurnId, turn]));
		return toResponse(
			results.map((result) => byId.get(result.sourceId)).filter(Boolean) as ChatTurn[]
		);
	},

	queryChatTurnsByKeywords: async (
		sessionId: string,
		keywords: string[],
		excludeIds: string[] = [],
		limit = 100
	): Promise<ChatResponse> => {
		const embeddingRows = await searchMemoryEmbeddingsByKeywords(
			keywords,
			{ sourceType: 'chat', sessionId },
			{ excludeSourceIds: excludeIds, limit }
		);
		const sourceIds = embeddingRows.map((row) => row.sourceId);
		if (!sourceIds.length) return emptyResponse();

		const rows = await getDatabase()
			.select({ data: chatTurnTable.data })
			.from(chatTurnTable)
			.where(and(eq(chatTurnTable.sessionId, sessionId), inArray(chatTurnTable.chatTurnId, sourceIds)))
			.limit(sourceIds.length);
		const byId = new Map(rows.map((row) => [row.data.chatTurnId, row.data]));

		return toResponse(sourceIds.map((sourceId) => byId.get(sourceId)).filter(Boolean) as ChatTurn[]);
	},

	_deleteChatTurn: async (chatTurnId: string): Promise<void> => {
		await getDatabase().delete(chatTurnTable).where(eq(chatTurnTable.chatTurnId, chatTurnId));
		await deleteMemoryEmbeddings('chat', chatTurnId);
	},

	clearChatCollectionCache: (): void => {},
};
