import { and, asc, desc, eq, gte, inArray, lt } from 'drizzle-orm';
import { ChatResponse, Metadata } from '@rita-berenice/shared/api';
import { ApiError, ChatTurn, DisplayTurn } from '@rita-berenice/shared/domain';
import { chatTurnToMetadata, isResponseEditAllowed, serializeChatEntries } from '@rita-berenice/shared/util';
import { DEFAULT_LOADING_BATCH_TURN_COUNT, RECENT_CHAT_TURN } from '@rita-berenice/shared/config';
import { getDatabase } from '../db/postgresClient.js';
import { chatTurns as chatTurnTable, memoryEmbeddings } from '../db/schema.js';
import {
  deleteMemoryEmbeddings,
  QueryEmbeddingCache,
  searchMemoryEmbeddingsByKeywords,
  searchMemoryEmbeddingCandidates,
} from '../service/embeddingService.js';
import { embeddingJobService } from '../service/embeddingJobService.js';
import { chatTurnToDocument } from '../util/documentUtils.js';
import { RagTraceContext } from '../util/ragTraceUtils.js';
import { FilterCriteria } from '../util/schemaUtils.js';

const emptyResponse = (): ChatResponse => ({ chatTurns: [], displayTurns: [] });

export const orderRecentChatTurnsForPrompt = (turnsDescending: ChatTurn[]): ChatTurn[] =>
  [...turnsDescending].reverse();

export const loadRecentChatTurnsForPrompt = async (
  sessionId: string,
  database: ReturnType<typeof getDatabase> = getDatabase(),
): Promise<ChatTurn[]> => {
  const rows = await database
    .select({ data: chatTurnTable.data })
    .from(chatTurnTable)
    .where(eq(chatTurnTable.sessionId, sessionId))
    .orderBy(desc(chatTurnTable.sequence))
    .limit(RECENT_CHAT_TURN);
  return orderRecentChatTurnsForPrompt(rows.map((row) => row.data));
};

export const buildSelectedChatTurnsWhere = (sessionId: string, sourceIds: string[], userId?: string) =>
  and(
    eq(chatTurnTable.sessionId, sessionId),
    ...(userId ? [eq(chatTurnTable.userId, userId)] : []),
    inArray(chatTurnTable.chatTurnId, sourceIds),
  )!;

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

/**
 * `displayOnly` means "the caller only renders these turns", so the search-index fields are left
 * out. They carry the whole conversation a second and third time - `documents` as flattened plain
 * text and `metadatas` as `requestJson` / `responseJson` - which on a session with thousands of
 * turns is the bulk of the response body, plus two `JSON.stringify` calls per turn, for data the
 * screen never reads.
 */
const toResponse = (items: ChatTurn[], displayOnly = false): ChatResponse => ({
  chatTurns: displayOnly ? [] : items,
  displayTurns: items.map(toDisplayTurn),
});

export interface StoreChatTurnOptions {
  enqueueEmbedding?: boolean;
}

const upsertTurn = async (turn: ChatTurn, options: StoreChatTurnOptions = {}): Promise<void> => {
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
  if (options.enqueueEmbedding === false) return;

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
  storeChatTurn: async (turn: ChatTurn, options: StoreChatTurnOptions = {}): Promise<{ chatTurnId: string }> => {
    await upsertTurn(turn, options);
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

  /** Fetch only finalized turns needed for stateless prompt continuity. */
  getRecentChatTurns: async (sessionId: string): Promise<ChatResponse> => {
    return toResponse(await loadRecentChatTurnsForPrompt(sessionId));
  },

  // Queries directly instead of narrowing `getAllChatTurns`: going through it would build the
  // documents/metadatas payload for every turn first, only to throw it away here.
  getAllDisplayTurns: async (sessionId: string): Promise<ChatResponse> => {
    const rows = await getDatabase()
      .select({ data: chatTurnTable.data })
      .from(chatTurnTable)
      .where(eq(chatTurnTable.sessionId, sessionId))
      .orderBy(asc(chatTurnTable.sequence));
    return toResponse(
      rows.map((row) => row.data),
      true,
    );
  },

  /**
   * One page of history walking backwards from `beforeSequence` (exclusive), returned oldest
   * first so it can be prepended to the log as-is. The page is taken with `desc` + `limit` and
   * then reversed - ordering ascending first would return the oldest turns in the session
   * rather than the ones immediately preceding `beforeSequence`.
   */
  getDisplayTurnsBeforeSequence: async (
    sessionId: string,
    beforeSequence: number,
    limit: number = DEFAULT_LOADING_BATCH_TURN_COUNT,
  ): Promise<ChatResponse> => {
    const rows = await getDatabase()
      .select({ data: chatTurnTable.data })
      .from(chatTurnTable)
      .where(and(eq(chatTurnTable.sessionId, sessionId), lt(chatTurnTable.sequence, beforeSequence)))
      .orderBy(desc(chatTurnTable.sequence))
      .limit(limit);
    return toResponse(rows.map((row) => row.data).reverse(), true);
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
      .where(and(eq(chatTurnTable.sessionId, sessionId), inArray(chatTurnTable.sequence, uniqueSequences)))
      .orderBy(asc(chatTurnTable.sequence));
    return toResponse(rows.map((row) => row.data));
  },

  queryChatTurns: async (
    sessionId: string,
    userId: string,
    queryTexts: string[],
    filterCriteria?: FilterCriteria,
    _whereDocument?: unknown,
    limit = 10,
    queryEmbeddingCache?: QueryEmbeddingCache,
    ragTraceContext?: RagTraceContext,
    excludeSourceIds: string[] = [],
  ): Promise<ChatResponse> => {
    // Structured criteria are folded into the embedding query. Filtering enriched arrays in
    // TypeScript would require loading every chat_turns.data value before ranking.
    const queryWithEmotion = filterCriteria?.emotion
      ? [...queryTexts, `conversation with ${filterCriteria.emotion} emotion`]
      : queryTexts;
    const results = await searchMemoryEmbeddingCandidates(
      queryWithEmotion,
      { sourceType: 'chat', sessionId, userId, excludeSourceIds },
      limit,
      queryEmbeddingCache,
      ragTraceContext,
    );
    const sourceIds = results.map((result) => result.sourceId);
    if (!sourceIds.length) return emptyResponse();

    const rows = await getDatabase()
      .select({ data: chatTurnTable.data })
      .from(chatTurnTable)
      .where(buildSelectedChatTurnsWhere(sessionId, sourceIds, userId))
      .limit(sourceIds.length);
    const byId = new Map(rows.map((row) => [row.data.chatTurnId, row.data]));
    return toResponse(sourceIds.map((sourceId) => byId.get(sourceId)).filter(Boolean) as ChatTurn[]);
  },

  queryChatTurnsByKeywords: async (
    sessionId: string,
    userId: string,
    keywords: string[],
    excludeIds: string[] = [],
    limit = 100,
  ): Promise<ChatResponse> => {
    const embeddingRows = await searchMemoryEmbeddingsByKeywords(
      keywords,
      { sourceType: 'chat', sessionId, userId },
      { excludeSourceIds: excludeIds, limit },
    );
    const sourceIds = embeddingRows.map((row) => row.sourceId);
    if (!sourceIds.length) return emptyResponse();

    const rows = await getDatabase()
      .select({ data: chatTurnTable.data })
      .from(chatTurnTable)
      .where(buildSelectedChatTurnsWhere(sessionId, sourceIds, userId))
      .limit(sourceIds.length);
    const byId = new Map(rows.map((row) => [row.data.chatTurnId, row.data]));

    return toResponse(sourceIds.map((sourceId) => byId.get(sourceId)).filter(Boolean) as ChatTurn[]);
  },

  _deleteChatTurn: async (chatTurnId: string): Promise<void> => {
    await getDatabase().delete(chatTurnTable).where(eq(chatTurnTable.chatTurnId, chatTurnId));
    await deleteMemoryEmbeddings('chat', chatTurnId);
  },

  /**
   * Edits an already-finalized turn's content in place (same chatTurnId/sequence) and
   * re-enqueues its embedding, since editing the request/response entries always changes
   * the document text that the embedding's contentHash is derived from.
   */
  updateChatTurn: async (
    chatTurnId: string,
    updates: Partial<Pick<ChatTurn, 'request' | 'response'>>,
  ): Promise<{ chatTurnId: string }> => {
    const existing = await getDatabase().query.chatTurns.findFirst({
      where: eq(chatTurnTable.chatTurnId, chatTurnId),
    });
    if (!existing) throw new ApiError(404, `Chat turn ${chatTurnId} not found.`);

    if (updates.response) {
      const originalText = serializeChatEntries(existing.data.response.entries, 'quoted-dialogue');
      const candidateText = serializeChatEntries(updates.response.entries, 'quoted-dialogue');
      if (!isResponseEditAllowed(originalText, candidateText)) {
        throw new ApiError(
          400,
          'Responses over the edit limit may only be shortened until they reach the ordinary edit limit.',
        );
      }
    }

    const updatedTurn: ChatTurn = {
      ...existing.data,
      request: updates.request ?? existing.data.request,
      response: updates.response ?? existing.data.response,
      updatedAt: new Date().toISOString(),
    };
    await upsertTurn(updatedTurn);
    return { chatTurnId };
  },

  /**
   * Deletes a turn and every turn after it in the session (tail truncation, not
   * renumbering) along with their embeddings. Runs as a single transaction so a mid-run
   * failure leaves nothing partially deleted.
   *
   * Deliberately leaves temp_chat_turns untouched: any temp row at or after fromSequence
   * survives as an orphan. This is what lets reroll work with no extra machinery - the
   * caller deletes from (target turn - 1) onward, so the preceding turn's original temp
   * candidates survive and resurface as "the next temp turn after the latest fixed turn"
   * (see ChatPage.tsx's tempSequence), ready to be reselected or regenerated through the
   * existing temp-turn UI.
   */
  deleteChatTurnsFromSequence: async (sessionId: string, fromSequence: number): Promise<{ deletedCount: number }> => {
    const deletedChatTurnIds = await getDatabase().transaction(async (tx) => {
      const targets = await tx
        .select({ chatTurnId: chatTurnTable.chatTurnId })
        .from(chatTurnTable)
        .where(and(eq(chatTurnTable.sessionId, sessionId), gte(chatTurnTable.sequence, fromSequence)));
      const chatTurnIds = targets.map((target) => target.chatTurnId);

      if (chatTurnIds.length) {
        await tx
          .delete(memoryEmbeddings)
          .where(and(eq(memoryEmbeddings.sourceType, 'chat'), inArray(memoryEmbeddings.sourceId, chatTurnIds)));
        await tx.delete(chatTurnTable).where(inArray(chatTurnTable.chatTurnId, chatTurnIds));
      }

      return chatTurnIds;
    });

    for (const chatTurnId of deletedChatTurnIds) {
      embeddingJobService.invalidate({ sourceType: 'chat', sourceId: chatTurnId });
    }
    return { deletedCount: deletedChatTurnIds.length };
  },

  clearChatCollectionCache: (): void => {},
};
