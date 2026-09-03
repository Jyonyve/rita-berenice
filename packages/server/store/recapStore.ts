import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { Metadata } from '@rita-berenice/shared/api';
import { METADATA_TYPES } from '@rita-berenice/shared/config';
import { ApiError, RecapInfo } from '@rita-berenice/shared/domain';
import { recapToMetadata } from '@rita-berenice/shared/util';
import { getDatabase } from '../db/postgresClient.js';
import { recaps } from '../db/schema.js';
import {
  QueryEmbeddingCache,
  searchMemoryEmbeddingCandidates,
  searchMemoryEmbeddingsByKeywords,
} from '../service/embeddingService.js';
import { embeddingJobService } from '../service/embeddingJobService.js';
import { recapToDocument } from '../util/documentUtils.js';
import { RagTraceContext } from '../util/ragTraceUtils.js';
import { FilterCriteria } from '../util/schemaUtils.js';

type RecapType = typeof METADATA_TYPES.RECAP | typeof METADATA_TYPES.RELATIONSHIP;

export const recapCandidateIdProjection = { recapId: recaps.recapId } as const;
export const latestRecapOrderBy = [desc(recaps.turnEnd), desc(recaps.updatedAt), desc(recaps.recapId)] as const;
export const buildRecapScopeWhere = (sessionId: string, userId: string, type: RecapType, sourceIds?: string[]) =>
  and(
    eq(recaps.sessionId, sessionId),
    eq(recaps.userId, userId),
    eq(recaps.recapType, type),
    ...(sourceIds?.length ? [inArray(recaps.recapId, sourceIds)] : []),
  )!;

const enqueueRecapEmbedding = (recapInfo: RecapInfo): void => {
  embeddingJobService.enqueue({
    sourceType: 'recap',
    sourceId: recapInfo.recapId,
    userId: recapInfo.userId,
    characterId: recapInfo.characterId,
    sessionId: recapInfo.sessionId,
    content: recapToDocument(recapInfo),
    metadata: recapToMetadata(recapInfo) as unknown as Metadata,
  });
};

export const recapStore = {
  async storeRecap(recapInfo: RecapInfo): Promise<{ recapId: string }> {
    if (!recapInfo.content?.trim()) return { recapId: '' };
    const now = new Date().toISOString();
    const storedRows = await getDatabase()
      .insert(recaps)
      .values({
        recapId: recapInfo.recapId,
        sessionId: recapInfo.sessionId,
        characterId: recapInfo.characterId,
        userId: recapInfo.userId,
        recapType: recapInfo.type,
        turnStart: recapInfo.turnStart,
        turnEnd: recapInfo.turnEnd,
        data: recapInfo,
        createdAt: recapInfo.createdAt || now,
        updatedAt: recapInfo.updatedAt || now,
      })
      .onConflictDoUpdate({
        target: recaps.recapId,
        setWhere: and(eq(recaps.userId, recapInfo.userId), eq(recaps.sessionId, recapInfo.sessionId)),
        set: {
          recapType: recapInfo.type,
          turnStart: recapInfo.turnStart,
          turnEnd: recapInfo.turnEnd,
          data: recapInfo,
          updatedAt: recapInfo.updatedAt || now,
        },
      })
      .returning({ recapId: recaps.recapId });
    if (!storedRows.length) {
      throw new ApiError(403, `Recap '${recapInfo.recapId}' belongs to another session or user.`);
    }
    enqueueRecapEmbedding(recapInfo);
    return { recapId: recapInfo.recapId };
  },

  async storeRecapIfAbsent(recapInfo: RecapInfo): Promise<{ recapId: string; created: boolean }> {
    if (!recapInfo.content?.trim()) return { recapId: '', created: false };
    const now = new Date().toISOString();
    const storedRows = await getDatabase()
      .insert(recaps)
      .values({
        recapId: recapInfo.recapId,
        sessionId: recapInfo.sessionId,
        characterId: recapInfo.characterId,
        userId: recapInfo.userId,
        recapType: recapInfo.type,
        turnStart: recapInfo.turnStart,
        turnEnd: recapInfo.turnEnd,
        data: recapInfo,
        createdAt: recapInfo.createdAt || now,
        updatedAt: recapInfo.updatedAt || now,
      })
      .onConflictDoNothing({ target: recaps.recapId })
      .returning({ recapId: recaps.recapId });
    if (!storedRows.length) return { recapId: recapInfo.recapId, created: false };
    enqueueRecapEmbedding(recapInfo);
    return { recapId: recapInfo.recapId, created: true };
  },

  async hasRecap(recapId: string, sessionId: string, userId: string): Promise<boolean> {
    const row = await getDatabase()
      .select({ recapId: recaps.recapId })
      .from(recaps)
      .where(and(eq(recaps.recapId, recapId), eq(recaps.sessionId, sessionId), eq(recaps.userId, userId)))
      .limit(1);
    return row.length > 0;
  },

  async getRecapsBySessionId(sessionId: string, userId: string, type: RecapType): Promise<RecapInfo[]> {
    const rows = await getDatabase()
      .select({ data: recaps.data })
      .from(recaps)
      .where(buildRecapScopeWhere(sessionId, userId, type))
      .orderBy(asc(recaps.turnStart));
    return rows.map((row) => row.data);
  },

  /** Relationship recaps describe cumulative state, so only the latest finalized range is used. */
  async getLatestRecap(sessionId: string, userId: string, type: RecapType): Promise<RecapInfo | undefined> {
    const [candidate] = await getDatabase()
      .select(recapCandidateIdProjection)
      .from(recaps)
      .where(buildRecapScopeWhere(sessionId, userId, type))
      .orderBy(...latestRecapOrderBy)
      .limit(1);
    if (!candidate) return undefined;

    const [row] = await getDatabase()
      .select({ data: recaps.data })
      .from(recaps)
      .where(buildRecapScopeWhere(sessionId, userId, type, [candidate.recapId]))
      .limit(1);
    return row?.data;
  },

  async queryRecaps(
    sessionId: string,
    userId: string,
    queryTexts: string[],
    type: RecapType,
    filterCriteria?: FilterCriteria,
    _whereDocument?: unknown,
    limit = 10,
    queryEmbeddingCache?: QueryEmbeddingCache,
    ragTraceContext?: RagTraceContext,
  ): Promise<RecapInfo[]> {
    void filterCriteria;
    const candidateRows = await getDatabase()
      .select(recapCandidateIdProjection)
      .from(recaps)
      .where(buildRecapScopeWhere(sessionId, userId, type));
    const candidateIds = candidateRows.map((row) => row.recapId);
    if (!candidateIds.length) return [];

    const results = await searchMemoryEmbeddingCandidates(
      queryTexts,
      { sourceType: 'recap', sessionId, userId, sourceIds: candidateIds },
      limit,
      queryEmbeddingCache,
      ragTraceContext,
    );
    const sourceIds = results.map((result) => result.sourceId);
    if (!sourceIds.length) return [];

    const rows = await getDatabase()
      .select({ data: recaps.data })
      .from(recaps)
      .where(buildRecapScopeWhere(sessionId, userId, type, sourceIds))
      .limit(sourceIds.length);
    const byId = new Map(rows.map((row) => [row.data.recapId, row.data]));
    return sourceIds.map((sourceId) => byId.get(sourceId)).filter(Boolean) as RecapInfo[];
  },

  async queryRecapsByKeywords(
    sessionId: string,
    userId: string,
    keywords: string[],
    type: RecapType,
    excludeIds: string[] = [],
    limit = 100,
  ): Promise<RecapInfo[]> {
    const embeddingRows = await searchMemoryEmbeddingsByKeywords(
      keywords,
      { sourceType: 'recap', sessionId, userId },
      { excludeSourceIds: excludeIds, limit },
    );
    const sourceIds = embeddingRows.map((row) => row.sourceId);
    if (!sourceIds.length) return [];

    const rows = await getDatabase()
      .select({ data: recaps.data })
      .from(recaps)
      .where(buildRecapScopeWhere(sessionId, userId, type, sourceIds))
      .limit(sourceIds.length);
    const byId = new Map(rows.map((row) => [row.data.recapId, row.data]));
    return sourceIds.map((sourceId) => byId.get(sourceId)).filter(Boolean) as RecapInfo[];
  },
};
