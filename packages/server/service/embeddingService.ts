import { createHash, randomUUID } from 'node:crypto';
import OpenAI from 'openai';
import { get_encoding } from 'tiktoken';
import { and, asc, cosineDistance, desc, eq, inArray, notInArray, or, sql } from 'drizzle-orm';
import { Metadata } from '@rita-berenice/shared/api';
import { getEmbeddingEnv } from '../config/env.js';
import { getDatabase } from '../db/postgresClient.js';
import { memoryEmbeddings } from '../db/schema.js';
import { RagTraceContext, traceRagEvent } from '../util/ragTraceUtils.js';

export const EMBEDDING_MODELS = ['text-embedding-3-small', 'text-embedding-3-large'] as const;
export type EmbeddingModel = (typeof EMBEDDING_MODELS)[number];
export const EMBEDDING_DIMENSIONS = 1536;
export const EMBEDDING_CHUNK_MAX_TOKENS = 6_000;
export const EMBEDDING_CHUNK_OVERLAP_TOKENS = 300;

export type MemorySourceType = 'chat' | 'lore' | 'history' | 'recap' | 'document';

export interface MemorySearchScope {
  sourceType: MemorySourceType | MemorySourceType[];
  userId?: string;
  characterId?: string;
  sessionId?: string;
  sourceIds?: string[];
  excludeSourceIds?: string[];
}

export interface MemorySearchResult {
  sourceType: MemorySourceType;
  sourceId: string;
  content: string;
  metadata: Metadata;
  distance: number;
}

export type MemorySearchCandidate = Pick<MemorySearchResult, 'sourceType' | 'sourceId' | 'distance'>;

export interface MemoryKeywordSearchResult {
  sourceId: string;
  hitScore: number;
}

export interface ReplaceMemoryEmbeddingInput {
  sourceType: MemorySourceType;
  sourceId: string;
  contentType?: string;
  userId: string;
  characterId?: string;
  sessionId?: string;
  content: string;
  metadata?: Metadata;
}

export type QueryEmbeddingCache = Map<string, Promise<number[]>>;
type QueryEmbedder = (input: string) => Promise<number[]>;

export const buildMemorySearchCandidateProjection = (distance: ReturnType<typeof cosineDistance>) => ({
  sourceType: memoryEmbeddings.sourceType,
  sourceId: memoryEmbeddings.sourceId,
  distance: sql<number>`${distance}`,
});

let openai: OpenAI | undefined;

const getOpenAI = () => {
  openai ??= new OpenAI({ apiKey: getEmbeddingEnv().OPENAI_API_KEY });
  return openai;
};

export const getConfiguredEmbeddingModel = (): EmbeddingModel => getEmbeddingEnv().OPENAI_EMBEDDING_MODEL;

export const createEmbeddingVectors = async (
  inputs: string[],
  model: EmbeddingModel = getConfiguredEmbeddingModel(),
): Promise<number[][]> => {
  if (inputs.length === 0) return [];
  const response = await getOpenAI().embeddings.create({
    model,
    input: inputs,
    dimensions: EMBEDDING_DIMENSIONS,
    encoding_format: 'float',
  });
  if (response.data.length !== inputs.length) {
    throw new Error(`Embedding model '${model}' returned ${response.data.length} vectors for ${inputs.length} inputs.`);
  }
  return [...response.data]
    .sort((left, right) => left.index - right.index)
    .map(({ embedding }, index) => {
      if (embedding.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(
          `Embedding model '${model}' returned ${embedding.length} dimensions for input ${index}; expected ${EMBEDDING_DIMENSIONS}.`,
        );
      }
      return embedding;
    });
};

export const createEmbeddingVector = async (
  input: string,
  model: EmbeddingModel = getConfiguredEmbeddingModel(),
): Promise<number[]> => (await createEmbeddingVectors([input], model))[0];

/**
 * Splits derived embedding input without changing the authoritative source record. Token-aware
 * chunks avoid provider input-limit failures for unusually long generated or imported turns.
 */
export const splitEmbeddingContent = (
  content: string,
  maxTokens: number = EMBEDDING_CHUNK_MAX_TOKENS,
  overlapTokens: number = EMBEDDING_CHUNK_OVERLAP_TOKENS,
): string[] => {
  if (!content) return [];
  if (maxTokens <= 0 || overlapTokens < 0 || overlapTokens >= maxTokens) {
    throw new Error('Embedding chunk token limits are invalid.');
  }

  const encoding = get_encoding('cl100k_base');
  try {
    if (encoding.encode(content).length <= maxTokens) return [content];

    // Work on Unicode code points rather than decoded token byte slices. Some BPE token
    // boundaries can sit inside a multi-byte character; decoding those slices would introduce
    // replacement characters into the derived index text.
    const characters = Array.from(content);
    const chunks: string[] = [];
    let start = 0;
    while (start < characters.length) {
      let low = start + 1;
      let high = characters.length;
      let end = low;
      while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        const tokenCount = encoding.encode(characters.slice(start, middle).join('')).length;
        if (tokenCount <= maxTokens) {
          end = middle;
          low = middle + 1;
        } else {
          high = middle - 1;
        }
      }

      const chunk = characters.slice(start, end).join('');
      if (encoding.encode(chunk).length > maxTokens) {
        throw new Error('Unable to create a bounded embedding chunk.');
      }
      chunks.push(chunk);
      if (end === characters.length) break;

      let overlapLow = start;
      let overlapHigh = end - 1;
      let nextStart = end;
      while (overlapLow <= overlapHigh) {
        const middle = Math.floor((overlapLow + overlapHigh) / 2);
        const tokenCount = encoding.encode(characters.slice(middle, end).join('')).length;
        if (tokenCount <= overlapTokens) {
          nextStart = middle;
          overlapHigh = middle - 1;
        } else {
          overlapLow = middle + 1;
        }
      }
      start = Math.max(nextStart, start + 1);
    }
    return chunks;
  } finally {
    encoding.free();
  }
};

export const createQueryEmbeddingCache = (): QueryEmbeddingCache => new Map();

export const resolveQueryEmbedding = (
  queryText: string,
  cache: QueryEmbeddingCache,
  embedder: QueryEmbedder = createEmbeddingVector,
): Promise<number[]> => {
  const cached = cache.get(queryText);
  if (cached) return cached;

  const pending = embedder(queryText).catch((error) => {
    if (cache.get(queryText) === pending) cache.delete(queryText);
    throw error;
  });
  cache.set(queryText, pending);
  return pending;
};

export const replaceMemoryEmbedding = async (input: ReplaceMemoryEmbeddingInput): Promise<void> => {
  const db = getDatabase();
  const contentHash = createHash('sha256').update(input.content).digest('hex');
  const embeddingModel = getConfiguredEmbeddingModel();
  const chunks = input.sourceType === 'chat' ? splitEmbeddingContent(input.content) : [input.content];
  const existing = await db.query.memoryEmbeddings.findMany({
    where: and(
      eq(memoryEmbeddings.sourceType, input.sourceType),
      eq(memoryEmbeddings.sourceId, input.sourceId),
      eq(memoryEmbeddings.contentHash, contentHash),
      eq(memoryEmbeddings.embeddingModel, embeddingModel),
      eq(memoryEmbeddings.active, true),
    ),
    columns: { embeddingId: true, metadata: true },
  });
  if (existing.length === chunks.length) {
    const rowsByChunkIndex = [...existing].sort(
      (left, right) =>
        Number((left.metadata as Record<string, unknown>).embeddingChunkIndex ?? 0) -
        Number((right.metadata as Record<string, unknown>).embeddingChunkIndex ?? 0),
    );
    const now = new Date().toISOString();
    await Promise.all(
      rowsByChunkIndex.map((row, chunkIndex) =>
        db
          .update(memoryEmbeddings)
          .set({
            contentType:
              chunks.length > 1 ? `${input.contentType ?? 'primary'}-chunk` : (input.contentType ?? 'primary'),
            userId: input.userId,
            characterId: input.characterId,
            sessionId: input.sessionId,
            content: chunks[chunkIndex],
            metadata: {
              ...(input.metadata ?? {}),
              embeddingChunkIndex: chunkIndex,
              embeddingChunkCount: chunks.length,
              authoritativeContentLength: input.content.length,
            },
            updatedAt: now,
          })
          .where(eq(memoryEmbeddings.embeddingId, row.embeddingId)),
      ),
    );
    return;
  }

  const vectors = await createEmbeddingVectors(chunks, embeddingModel);
  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    await tx
      .update(memoryEmbeddings)
      .set({ active: false, updatedAt: now })
      .where(and(eq(memoryEmbeddings.sourceType, input.sourceType), eq(memoryEmbeddings.sourceId, input.sourceId)));
    await tx.insert(memoryEmbeddings).values(
      chunks.map((chunk, chunkIndex) => ({
        embeddingId: randomUUID(),
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        contentType: chunks.length > 1 ? `${input.contentType ?? 'primary'}-chunk` : (input.contentType ?? 'primary'),
        userId: input.userId,
        characterId: input.characterId,
        sessionId: input.sessionId,
        content: chunk,
        contentHash,
        embeddingModel,
        embeddingVersion: 1,
        embedding: vectors[chunkIndex],
        metadata: {
          ...(input.metadata ?? {}),
          embeddingChunkIndex: chunkIndex,
          embeddingChunkCount: chunks.length,
          authoritativeContentLength: input.content.length,
        },
        active: true,
        createdAt: now,
        updatedAt: now,
      })),
    );
  });
};

export const deleteMemoryEmbeddings = async (sourceType: MemorySourceType, sourceId: string): Promise<void> => {
  await getDatabase()
    .delete(memoryEmbeddings)
    .where(and(eq(memoryEmbeddings.sourceType, sourceType), eq(memoryEmbeddings.sourceId, sourceId)));
};

export const searchMemoryEmbeddings = async (
  queryTexts: string[],
  scope: MemorySearchScope,
  limit = 10,
  queryEmbeddingCache: QueryEmbeddingCache = createQueryEmbeddingCache(),
  ragTraceContext?: RagTraceContext,
): Promise<MemorySearchResult[]> => {
  return (await searchMemoryEmbeddingRows(
    queryTexts,
    scope,
    limit,
    queryEmbeddingCache,
    ragTraceContext,
    true,
  )) as MemorySearchResult[];
};

/**
 * Ranks authoritative source IDs without transferring embedding document text or metadata.
 * Callers must rehydrate only the selected IDs from their PostgreSQL source table.
 */
export const searchMemoryEmbeddingCandidates = async (
  queryTexts: string[],
  scope: MemorySearchScope,
  limit = 10,
  queryEmbeddingCache: QueryEmbeddingCache = createQueryEmbeddingCache(),
  ragTraceContext?: RagTraceContext,
): Promise<MemorySearchCandidate[]> => {
  return (await searchMemoryEmbeddingRows(
    queryTexts,
    scope,
    limit,
    queryEmbeddingCache,
    ragTraceContext,
    false,
  )) as MemorySearchCandidate[];
};

const searchMemoryEmbeddingRows = async (
  queryTexts: string[],
  scope: MemorySearchScope,
  limit: number,
  queryEmbeddingCache: QueryEmbeddingCache,
  ragTraceContext: RagTraceContext | undefined,
  includePayload: boolean,
): Promise<Array<MemorySearchResult | MemorySearchCandidate>> => {
  if (queryTexts.length === 0) return [];
  const db = getDatabase();
  const bestBySource = new Map<string, MemorySearchResult | MemorySearchCandidate>();
  const embeddingModel = getConfiguredEmbeddingModel();

  for (const [queryIndex, queryText] of queryTexts.entries()) {
    const embeddingReused = queryEmbeddingCache.has(queryText);
    const queryEmbedding = await resolveQueryEmbedding(queryText, queryEmbeddingCache);
    const distance = cosineDistance(memoryEmbeddings.embedding, queryEmbedding);
    const sourceTypes = Array.isArray(scope.sourceType) ? scope.sourceType : [scope.sourceType];
    const conditions = [
      sourceTypes.length === 1
        ? eq(memoryEmbeddings.sourceType, sourceTypes[0])
        : inArray(memoryEmbeddings.sourceType, sourceTypes),
      eq(memoryEmbeddings.active, true),
      eq(memoryEmbeddings.embeddingModel, embeddingModel),
    ];
    if (scope.userId) conditions.push(eq(memoryEmbeddings.userId, scope.userId));
    if (scope.characterId) conditions.push(eq(memoryEmbeddings.characterId, scope.characterId));
    if (scope.sessionId) conditions.push(eq(memoryEmbeddings.sessionId, scope.sessionId));
    if (scope.sourceIds?.length) conditions.push(inArray(memoryEmbeddings.sourceId, scope.sourceIds));
    if (scope.excludeSourceIds?.length) conditions.push(notInArray(memoryEmbeddings.sourceId, scope.excludeSourceIds));

    const rows = includePayload
      ? await db
          .select({
            sourceType: memoryEmbeddings.sourceType,
            sourceId: memoryEmbeddings.sourceId,
            content: memoryEmbeddings.content,
            metadata: memoryEmbeddings.metadata,
            distance: sql<number>`${distance}`,
          })
          .from(memoryEmbeddings)
          .where(and(...conditions))
          .orderBy(asc(distance))
          .limit(Math.min(limit * 3, 50))
      : await db
          .select(buildMemorySearchCandidateProjection(distance))
          .from(memoryEmbeddings)
          .where(and(...conditions))
          .orderBy(asc(distance))
          .limit(Math.min(limit * 3, 50));

    if (ragTraceContext) {
      traceRagEvent(ragTraceContext, 'search.results', {
        queryIndex,
        queryText,
        embeddingReused,
        embeddingModel,
        sourceTypes,
        limit,
        scope: {
          hasUserScope: Boolean(scope.userId),
          hasCharacterScope: Boolean(scope.characterId),
          hasSessionScope: Boolean(scope.sessionId),
          sourceIdCount: scope.sourceIds?.length ?? 0,
          excludedSourceIdCount: scope.excludeSourceIds?.length ?? 0,
        },
        results: rows.map((row, rank) => ({
          rank: rank + 1,
          sourceType: row.sourceType,
          sourceId: row.sourceId,
          distance: row.distance,
        })),
      });
    }

    for (const row of rows) {
      const result: MemorySearchResult | MemorySearchCandidate = includePayload
        ? (() => {
            const payloadRow = row as {
              sourceType: string;
              sourceId: string;
              content: string;
              metadata: unknown;
              distance: number;
            };
            return {
              ...payloadRow,
              sourceType: payloadRow.sourceType as MemorySourceType,
              metadata: payloadRow.metadata as Metadata,
            };
          })()
        : {
            sourceType: row.sourceType as MemorySourceType,
            sourceId: row.sourceId,
            distance: row.distance,
          };
      const sourceKey = `${result.sourceType}:${result.sourceId}`;
      const current = bestBySource.get(sourceKey);
      if (!current || row.distance < current.distance) bestBySource.set(sourceKey, result);
    }
  }

  const selected = [...bestBySource.values()].sort((a, b) => a.distance - b.distance).slice(0, limit);
  if (ragTraceContext) {
    traceRagEvent(ragTraceContext, 'search.complete', {
      sourceTypes: Array.isArray(scope.sourceType) ? scope.sourceType : [scope.sourceType],
      queryCount: queryTexts.length,
      selected: selected.map((result, rank) => ({
        rank: rank + 1,
        sourceType: result.sourceType,
        sourceId: result.sourceId,
        distance: result.distance,
      })),
    });
  }
  return selected;
};

export const searchMemoryEmbeddingsByKeywords = async (
  keywords: string[],
  scope: Omit<MemorySearchScope, 'sourceType'> & { sourceType: MemorySourceType },
  options: { excludeSourceIds?: string[]; limit?: number } = {},
): Promise<MemoryKeywordSearchResult[]> => {
  const normalizedKeywords = [...new Set(keywords.map((keyword) => keyword.toLowerCase().trim()))]
    .filter((keyword) => keyword.length >= 2)
    .slice(0, 25);
  if (!normalizedKeywords.length) return [];

  const keywordCondition = or(
    ...normalizedKeywords.map((keyword) => sql`position(${keyword} in lower(${memoryEmbeddings.content})) > 0`),
  );
  if (!keywordCondition) return [];
  const hitScore = sql<number>`${sql.join(
    normalizedKeywords.map(
      (keyword) => sql`case when position(${keyword} in lower(${memoryEmbeddings.content})) > 0 then 1 else 0 end`,
    ),
    sql` + `,
  )}`;

  const conditions = [
    eq(memoryEmbeddings.sourceType, scope.sourceType),
    eq(memoryEmbeddings.active, true),
    eq(memoryEmbeddings.embeddingModel, getConfiguredEmbeddingModel()),
    keywordCondition,
  ];
  if (scope.userId) conditions.push(eq(memoryEmbeddings.userId, scope.userId));
  if (scope.characterId) conditions.push(eq(memoryEmbeddings.characterId, scope.characterId));
  if (scope.sessionId) conditions.push(eq(memoryEmbeddings.sessionId, scope.sessionId));
  if (scope.sourceIds?.length) conditions.push(inArray(memoryEmbeddings.sourceId, scope.sourceIds));
  if (options.excludeSourceIds?.length) {
    conditions.push(notInArray(memoryEmbeddings.sourceId, options.excludeSourceIds));
  }

  const bestHitScore = sql<number>`max(${hitScore})`;
  return getDatabase()
    .select({ sourceId: memoryEmbeddings.sourceId, hitScore: bestHitScore })
    .from(memoryEmbeddings)
    .where(and(...conditions))
    .groupBy(memoryEmbeddings.sourceId)
    .orderBy(desc(bestHitScore), asc(sql<number>`length(${memoryEmbeddings.sourceId})`), asc(memoryEmbeddings.sourceId))
    .limit(options.limit ?? 100);
};
