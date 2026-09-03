import { and, eq, inArray } from 'drizzle-orm';
import { HistoryResponse, Metadata } from '@rita-berenice/shared/api';
import { ApiError, HistoryInfo } from '@rita-berenice/shared/domain';
import { historyToMetadata } from '@rita-berenice/shared/util';
import { getDatabase } from '../db/postgresClient.js';
import { histories } from '../db/schema.js';
import {
  deleteMemoryEmbeddings,
  QueryEmbeddingCache,
  searchMemoryEmbeddingCandidates,
  searchMemoryEmbeddingsByKeywords,
} from '../service/embeddingService.js';
import { embeddingJobService } from '../service/embeddingJobService.js';
import { historyToDocument } from '../util/documentUtils.js';
import { FilterCriteria } from '../util/schemaUtils.js';
import { getHistoryImageUrl } from '../util/imageStorageUtils.js';
import { RagTraceContext } from '../util/ragTraceUtils.js';

const emptyResponse = (): HistoryResponse => ({
  historyInfo: {} as HistoryInfo,
  historyContent: '',
  historyInfos: [],
  historyContents: [],
  historyImageUrls: {},
});

const toResponse = async (items: HistoryInfo[]): Promise<HistoryResponse> => {
  const imageEntries = await Promise.all(
    items.map(async (item) => [item.historyId, await getHistoryImageUrl(item.characterId, item.historyId)] as const),
  );

  return {
    historyInfo: items[0] ?? ({} as HistoryInfo),
    historyContent: items[0]?.content ?? '',
    historyInfos: items,
    historyContents: items.map((item) => item.content),
    historyImageUrls: Object.fromEntries(
      imageEntries.filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
    ),
  };
};

export const historyCandidateIdProjection = { historyId: histories.historyId } as const;
export const buildHistoryScopeWhere = (characterId: string, creatorUserId: string, sourceIds?: string[]) =>
  and(
    eq(histories.characterId, characterId),
    eq(histories.userId, creatorUserId),
    ...(sourceIds?.length ? [inArray(histories.historyId, sourceIds)] : []),
  )!;

export const historyStore = {
  storeHistory: async (historyInfo: HistoryInfo): Promise<{ historyId: string }> => {
    const now = new Date().toISOString();
    const storedRows = await getDatabase()
      .insert(histories)
      .values({
        historyId: historyInfo.historyId,
        characterId: historyInfo.characterId,
        userId: historyInfo.userId,
        category: historyInfo.category,
        data: historyInfo,
        createdAt: historyInfo.createdAt || now,
        updatedAt: historyInfo.updatedAt || now,
      })
      .onConflictDoUpdate({
        target: histories.historyId,
        setWhere: eq(histories.userId, historyInfo.userId),
        set: {
          characterId: historyInfo.characterId,
          userId: historyInfo.userId,
          category: historyInfo.category,
          data: historyInfo,
          updatedAt: historyInfo.updatedAt || now,
        },
      })
      .returning({ historyId: histories.historyId });
    if (!storedRows.length) {
      throw new ApiError(403, `History '${historyInfo.historyId}' is owned by another user.`);
    }
    embeddingJobService.enqueue({
      sourceType: 'history',
      sourceId: historyInfo.historyId,
      userId: historyInfo.userId,
      characterId: historyInfo.characterId,
      content: historyToDocument(historyInfo),
      metadata: historyToMetadata(historyInfo) as unknown as Metadata,
    });
    return { historyId: historyInfo.historyId };
  },

  getHistoryScope: async (historyId: string): Promise<{ characterId: string; userId: string } | null> => {
    const [row] = await getDatabase()
      .select({ characterId: histories.characterId, userId: histories.userId })
      .from(histories)
      .where(eq(histories.historyId, historyId))
      .limit(1);
    return row ?? null;
  },

  getHistory: async (historyId: string, ownerUserId: string): Promise<HistoryResponse> => {
    const row = await getDatabase().query.histories.findFirst({
      where: and(eq(histories.historyId, historyId), eq(histories.userId, ownerUserId)),
    });
    return row ? await toResponse([row.data]) : emptyResponse();
  },

  getHistories: async (characterId: string, ownerUserId?: string): Promise<HistoryResponse> => {
    const rows = await getDatabase()
      .select({ data: histories.data })
      .from(histories)
      .where(
        ownerUserId
          ? and(eq(histories.characterId, characterId), eq(histories.userId, ownerUserId))
          : eq(histories.characterId, characterId),
      );
    return await toResponse(rows.map((row) => row.data));
  },

  deleteHistory: async (historyId: string): Promise<void> => {
    await getDatabase().delete(histories).where(eq(histories.historyId, historyId));
    await deleteMemoryEmbeddings('history', historyId);
  },

  queryHistories: async (
    characterId: string,
    creatorUserId: string,
    queryTexts: string[],
    filterCriteria?: FilterCriteria,
    _whereDocument?: unknown,
    limit = 10,
    queryEmbeddingCache?: QueryEmbeddingCache,
    ragTraceContext?: RagTraceContext,
  ): Promise<HistoryResponse> => {
    void filterCriteria;
    const candidateRows = await getDatabase()
      .select(historyCandidateIdProjection)
      .from(histories)
      .where(buildHistoryScopeWhere(characterId, creatorUserId));
    const candidateIds = candidateRows.map((row) => row.historyId);
    if (!candidateIds.length) return emptyResponse();

    const results = await searchMemoryEmbeddingCandidates(
      queryTexts,
      { sourceType: 'history', characterId, userId: creatorUserId, sourceIds: candidateIds },
      limit,
      queryEmbeddingCache,
      ragTraceContext,
    );
    const sourceIds = results.map((result) => result.sourceId);
    if (!sourceIds.length) return emptyResponse();
    const rows = await getDatabase()
      .select({ data: histories.data })
      .from(histories)
      .where(buildHistoryScopeWhere(characterId, creatorUserId, sourceIds))
      .limit(sourceIds.length);
    const byId = new Map(rows.map((row) => [row.data.historyId, row.data]));
    return await toResponse(sourceIds.map((sourceId) => byId.get(sourceId)).filter(Boolean) as HistoryInfo[]);
  },

  // Mirrors chatStore.queryChatTurnsByKeywords / recapStore.queryRecapsByKeywords: a
  // keyword pass over the embedded Korean document text rescues retrieval when the
  // semantic search missed. History is character-scoped because it has no session.
  queryHistoriesByKeywords: async (
    characterId: string,
    creatorUserId: string,
    keywords: string[],
    excludeIds: string[] = [],
    limit = 100,
  ): Promise<HistoryResponse> => {
    const embeddingRows = await searchMemoryEmbeddingsByKeywords(
      keywords,
      { sourceType: 'history', characterId, userId: creatorUserId },
      { excludeSourceIds: excludeIds, limit },
    );
    const sourceIds = embeddingRows.map((row) => row.sourceId);
    if (!sourceIds.length) return emptyResponse();

    const rows = await getDatabase()
      .select({ data: histories.data })
      .from(histories)
      .where(buildHistoryScopeWhere(characterId, creatorUserId, sourceIds))
      .limit(sourceIds.length);
    const byId = new Map(rows.map((row) => [row.data.historyId, row.data]));
    return toResponse(sourceIds.map((sourceId) => byId.get(sourceId)).filter(Boolean) as HistoryInfo[]);
  },

  clearCollectionCache: (): void => {},
};
