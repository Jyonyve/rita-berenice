import { and, eq, inArray, isNull, or, SQL, sql } from 'drizzle-orm';
import { LoreResponse, Metadata } from '@rita-berenice/shared/api';
import { ApiError, LoreCategory, LoreInfo, MiscLoreInfo, WorldLoreInfo } from '@rita-berenice/shared/domain';
import { METADATA_TYPES } from '@rita-berenice/shared/config';
import { isLoreRetrievalEnabled, loreToMetadata } from '@rita-berenice/shared/util';
import { getDatabase } from '../db/postgresClient.js';
import { loreCharacterLinks, lores } from '../db/schema.js';
import { deleteMemoryEmbeddings, QueryEmbeddingCache, searchMemoryEmbeddings } from '../service/embeddingService.js';
import { embeddingJobService } from '../service/embeddingJobService.js';
import { loreToDocument } from '../util/documentUtils.js';
import { RagTraceContext } from '../util/ragTraceUtils.js';
import { FilterCriteria } from '../util/schemaUtils.js';

type LoreRow = typeof lores.$inferSelect;

export const loreCandidateIdProjection = { loreId: lores.loreId } as const;

const emptyResponse = (): LoreResponse => ({
  loreInfo: {} as LoreInfo,
  loreContent: '',
  loreInfos: [],
  loreContents: [],
});

const toResponse = (items: LoreInfo[]): LoreResponse => ({
  loreInfo: items[0] ?? ({} as LoreInfo),
  loreContent: items[0]?.content ?? '',
  loreInfos: items,
  loreContents: items.map((item) => item.content),
});

export const hydrateLoreRow = (row: LoreRow, characterIds: string[]): LoreInfo => {
  const common = {
    loreId: row.loreId,
    userId: row.userId,
    sessionId: row.sessionId ?? undefined,
    retrievalEnabled: row.retrievalEnabled,
    title: row.title,
    generatedTitle: row.generatedTitle,
    content: row.content,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    characterIds,
    keywordList: row.keywordList,
    topicList: row.topicList,
    entityList: row.entityList,
  };

  if (row.loreType === METADATA_TYPES.WORLD) {
    return { ...common, type: METADATA_TYPES.WORLD, category: 'World' } satisfies WorldLoreInfo;
  }

  return {
    ...common,
    type: METADATA_TYPES.LORE,
    category: row.category as Exclude<LoreCategory, 'World'>,
    source: row.source ?? '',
  } satisfies MiscLoreInfo;
};

const loadLoreInfos = async (where: SQL<unknown>): Promise<LoreInfo[]> => {
  const database = getDatabase();
  const rows = await database.select().from(lores).where(where);
  if (!rows.length) return [];

  const links = await database
    .select({ loreId: loreCharacterLinks.loreId, characterId: loreCharacterLinks.characterId })
    .from(loreCharacterLinks)
    .where(
      inArray(
        loreCharacterLinks.loreId,
        rows.map((row) => row.loreId),
      ),
    );
  const charactersByLoreId = new Map<string, string[]>();
  for (const link of links) {
    const characterIds = charactersByLoreId.get(link.loreId) ?? [];
    characterIds.push(link.characterId);
    charactersByLoreId.set(link.loreId, characterIds);
  }

  return rows.map((row) => hydrateLoreRow(row, charactersByLoreId.get(row.loreId) ?? []));
};

const loadLoreIds = async (where: SQL<unknown>): Promise<string[]> => {
  const rows = await getDatabase().select(loreCandidateIdProjection).from(lores).where(where);
  return rows.map((row) => row.loreId);
};

const getRequestedTerms = (criteria?: FilterCriteria): string[] =>
  [
    ...(criteria?.keywords ?? []),
    ...(criteria?.topics ?? []),
    ...(criteria?.entities?.characters ?? []),
    ...(criteria?.entities?.locations ?? []),
    ...(criteria?.entities?.items ?? []),
  ]
    .map((value) => value.toLowerCase())
    .filter((value, index, values) => value.length > 0 && values.indexOf(value) === index);

const matchesLinkedCharacter = (characterIds: string[]): SQL<unknown> =>
  sql`exists (
    select 1 from ${loreCharacterLinks}
    where ${loreCharacterLinks.loreId} = ${lores.loreId}
      and ${inArray(loreCharacterLinks.characterId, characterIds)}
  )`;

const matchesRequestedTerms = (requestedTerms: string[]): SQL<unknown> => {
  const requestedSql = sql.join(
    requestedTerms.map((term) => sql`${term}`),
    sql`, `,
  );
  return sql`(
    exists (
      select 1
      from unnest(${lores.keywordList} || ${lores.topicList} || ${lores.entityList}) as lore_term(value)
      where lower(lore_term.value) in (${requestedSql})
    )
    or exists (
      select 1 from ${loreCharacterLinks}
      where ${loreCharacterLinks.loreId} = ${lores.loreId}
        and lower(${loreCharacterLinks.characterId}) in (${requestedSql})
    )
  )`;
};

export const buildLoreCandidateWhere = (
  sessionUserId: string,
  characterIds: string | string[],
  sessionId?: string,
  filterCriteria?: FilterCriteria,
  creatorUserId: string = sessionUserId,
): SQL<unknown> => {
  const ids = Array.isArray(characterIds) ? characterIds : [characterIds];
  const requestedTerms = getRequestedTerms(filterCriteria);
  const officialEligibility = requestedTerms.length
    ? or(eq(lores.category, 'World'), matchesLinkedCharacter(ids), matchesRequestedTerms(requestedTerms))
    : sql`true`;
  const officialScope = and(eq(lores.userId, creatorUserId), isNull(lores.sessionId), officialEligibility);
  const sessionScope = sessionId ? and(eq(lores.userId, sessionUserId), eq(lores.sessionId, sessionId)) : undefined;

  return and(eq(lores.retrievalEnabled, true), sessionScope ? or(officialScope, sessionScope) : officialScope)!;
};

const buildCharacterLoreWhere = (characterId: string, userId: string, retrievalOnly: boolean): SQL<unknown> =>
  and(
    eq(lores.userId, userId),
    isNull(lores.sessionId),
    or(eq(lores.category, 'World'), matchesLinkedCharacter([characterId])),
    retrievalOnly ? eq(lores.retrievalEnabled, true) : undefined,
  )!;

export const shouldEnqueueLoreEmbedding = (loreInfo: LoreInfo): boolean => isLoreRetrievalEnabled(loreInfo);

const enqueueLoreEmbedding = (loreInfo: LoreInfo): void => {
  embeddingJobService.enqueue({
    sourceType: 'lore',
    sourceId: loreInfo.loreId,
    userId: loreInfo.userId,
    content: loreToDocument(loreInfo),
    metadata: loreToMetadata(loreInfo) as unknown as Metadata,
  });
};

const toLoreValues = (loreInfo: LoreInfo) => ({
  loreId: loreInfo.loreId,
  userId: loreInfo.userId,
  sessionId: loreInfo.sessionId,
  loreType: loreInfo.type,
  category: loreInfo.category,
  title: loreInfo.title,
  generatedTitle: loreInfo.generatedTitle,
  content: loreInfo.content,
  source: loreInfo.type === METADATA_TYPES.LORE ? loreInfo.source : null,
  retrievalEnabled: loreInfo.retrievalEnabled === true,
  keywordList: loreInfo.keywordList ?? [],
  topicList: loreInfo.topicList ?? [],
  entityList: loreInfo.entityList ?? [],
  createdAt: loreInfo.createdAt,
  updatedAt: loreInfo.updatedAt,
});

export const loreStore = {
  storeLore: async (loreInfo: LoreInfo): Promise<{ loreId: string }> => {
    const database = getDatabase();
    const now = new Date().toISOString();
    const values = {
      ...toLoreValues(loreInfo),
      createdAt: loreInfo.createdAt || now,
      updatedAt: loreInfo.updatedAt || now,
    };

    await database.transaction(async (transaction) => {
      const storedRows = await transaction
        .insert(lores)
        .values(values)
        .onConflictDoUpdate({
          target: lores.loreId,
          setWhere: eq(lores.userId, loreInfo.userId),
          set: {
            sessionId: values.sessionId,
            loreType: values.loreType,
            category: values.category,
            title: values.title,
            generatedTitle: values.generatedTitle,
            content: values.content,
            source: values.source,
            retrievalEnabled: values.retrievalEnabled,
            keywordList: values.keywordList,
            topicList: values.topicList,
            entityList: values.entityList,
            updatedAt: values.updatedAt,
          },
        })
        .returning({ loreId: lores.loreId });
      if (storedRows.length === 0) {
        throw new ApiError(403, `Lore '${loreInfo.loreId}' is owned by another user.`);
      }

      await transaction.delete(loreCharacterLinks).where(eq(loreCharacterLinks.loreId, loreInfo.loreId));
      const characterIds = [...new Set(loreInfo.characterIds ?? [])];
      if (characterIds.length) {
        await transaction.insert(loreCharacterLinks).values(
          characterIds.map((characterId) => ({
            loreId: loreInfo.loreId,
            characterId,
          })),
        );
      }
    });

    if (shouldEnqueueLoreEmbedding(loreInfo)) enqueueLoreEmbedding(loreInfo);
    return { loreId: loreInfo.loreId };
  },

  getLore: async (loreId: string, userId: string): Promise<LoreResponse> =>
    toResponse(await loadLoreInfos(and(eq(lores.loreId, loreId), eq(lores.userId, userId))!)),

  getActiveLoresByCharacter: async (characterId: string, ownerUserId: string): Promise<LoreResponse> =>
    toResponse(await loadLoreInfos(buildCharacterLoreWhere(characterId, ownerUserId, true))),

  getEditableLoresByCharacter: async (characterId: string, userId: string): Promise<LoreResponse> =>
    toResponse(await loadLoreInfos(buildCharacterLoreWhere(characterId, userId, false))),

  getLoresBySession: async (sessionId: string, userId: string): Promise<LoreResponse> =>
    toResponse(await loadLoreInfos(and(eq(lores.userId, userId), eq(lores.sessionId, sessionId))!)),

  getActiveLoresForSession: async (
    sessionId: string,
    characterId: string,
    sessionUserId: string,
    creatorUserId: string = sessionUserId,
  ): Promise<LoreResponse> =>
    toResponse(
      await loadLoreInfos(buildLoreCandidateWhere(sessionUserId, characterId, sessionId, undefined, creatorUserId)),
    ),

  setRetrievalPreference: async (loreId: string, userId: string, enabled: boolean): Promise<LoreInfo> => {
    const now = new Date().toISOString();
    const rows = await getDatabase()
      .update(lores)
      .set({ retrievalEnabled: enabled, updatedAt: now })
      .where(and(eq(lores.loreId, loreId), eq(lores.userId, userId)))
      .returning({ loreId: lores.loreId });
    if (!rows[0]) throw new ApiError(404, `Lore '${loreId}' was not found.`);

    const [updated] = await loadLoreInfos(and(eq(lores.loreId, loreId), eq(lores.userId, userId))!);
    if (!updated) throw new ApiError(409, 'The lore retrieval setting changed concurrently.');
    if (enabled) enqueueLoreEmbedding(updated);
    return updated;
  },

  deleteLore: async (loreId: string, userId: string): Promise<void> => {
    const deletedRows = await getDatabase()
      .delete(lores)
      .where(and(eq(lores.loreId, loreId), eq(lores.userId, userId)))
      .returning({ loreId: lores.loreId });
    if (deletedRows.length > 0) await deleteMemoryEmbeddings('lore', loreId);
  },

  queryLores: async (
    characterIds: string | string[],
    userId: string,
    sessionId: string,
    queryTexts: string[],
    filterCriteria?: FilterCriteria,
    _whereDocument?: unknown,
    limit = 10,
    queryEmbeddingCache?: QueryEmbeddingCache,
    ragTraceContext?: RagTraceContext,
    creatorUserId: string = userId,
  ): Promise<LoreResponse> => {
    const candidateIds = await loadLoreIds(
      buildLoreCandidateWhere(userId, characterIds, sessionId, filterCriteria, creatorUserId),
    );
    if (!candidateIds.length) return emptyResponse();
    const results = await searchMemoryEmbeddings(
      queryTexts,
      // The source IDs come from the authoritative SQL ownership/scope query above.
      { sourceType: 'lore', sourceIds: candidateIds },
      limit,
      queryEmbeddingCache,
      ragTraceContext,
    );
    const selectedIds = results.map((result) => result.sourceId);
    if (!selectedIds.length) return emptyResponse();
    const selected = await loadLoreInfos(
      and(
        inArray(lores.loreId, selectedIds),
        buildLoreCandidateWhere(userId, characterIds, sessionId, filterCriteria, creatorUserId),
      )!,
    );
    const byId = new Map(selected.map((item) => [item.loreId, item]));
    return toResponse(results.map((result) => byId.get(result.sourceId)).filter(Boolean) as LoreInfo[]);
  },

  clearCollectionCache: (): void => {},
};
