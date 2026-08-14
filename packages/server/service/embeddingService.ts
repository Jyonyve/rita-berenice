import { createHash, randomUUID } from 'node:crypto';
import OpenAI from 'openai';
import { and, asc, cosineDistance, desc, eq, inArray, notInArray, or, sql } from 'drizzle-orm';
import { Metadata } from '@rita-berenice/shared/api';
import { getEmbeddingEnv } from '../config/env.js';
import { getDatabase } from '../db/postgresClient.js';
import { memoryEmbeddings } from '../db/schema.js';
import { RagTraceContext, traceRagEvent } from '../util/ragTraceUtils.js';

export const EMBEDDING_MODELS = ['text-embedding-3-small', 'text-embedding-3-large'] as const;
export type EmbeddingModel = (typeof EMBEDDING_MODELS)[number];
export const EMBEDDING_DIMENSIONS = 1536;

export type MemorySourceType = 'chat' | 'lore' | 'history' | 'recap' | 'document';

export interface MemorySearchScope {
	sourceType: MemorySourceType | MemorySourceType[];
	userId?: string;
	characterId?: string;
	sessionId?: string;
	sourceIds?: string[];
}

export interface MemorySearchResult {
	sourceType: MemorySourceType;
	sourceId: string;
	content: string;
	metadata: Metadata;
	distance: number;
}

export interface MemoryKeywordSearchResult {
	sourceId: string;
	content: string;
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

let openai: OpenAI | undefined;

const getOpenAI = () => {
	openai ??= new OpenAI({ apiKey: getEmbeddingEnv().OPENAI_API_KEY });
	return openai;
};

export const getConfiguredEmbeddingModel = (): EmbeddingModel =>
	getEmbeddingEnv().OPENAI_EMBEDDING_MODEL;

export const createEmbeddingVectors = async (
	inputs: string[],
	model: EmbeddingModel = getConfiguredEmbeddingModel()
): Promise<number[][]> => {
	if (inputs.length === 0) return [];
	const response = await getOpenAI().embeddings.create({
		model,
		input: inputs,
		dimensions: EMBEDDING_DIMENSIONS,
		encoding_format: 'float',
	});
	if (response.data.length !== inputs.length) {
		throw new Error(
			`Embedding model '${model}' returned ${response.data.length} vectors for ${inputs.length} inputs.`
		);
	}
	return [...response.data]
		.sort((left, right) => left.index - right.index)
		.map(({ embedding }, index) => {
			if (embedding.length !== EMBEDDING_DIMENSIONS) {
				throw new Error(
					`Embedding model '${model}' returned ${embedding.length} dimensions for input ${index}; expected ${EMBEDDING_DIMENSIONS}.`
				);
			}
			return embedding;
		});
};

export const createEmbeddingVector = async (
	input: string,
	model: EmbeddingModel = getConfiguredEmbeddingModel()
): Promise<number[]> => (await createEmbeddingVectors([input], model))[0];

export const createQueryEmbeddingCache = (): QueryEmbeddingCache => new Map();

export const resolveQueryEmbedding = (
	queryText: string,
	cache: QueryEmbeddingCache,
	embedder: QueryEmbedder = createEmbeddingVector
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
	const existing = await db.query.memoryEmbeddings.findFirst({
		where: and(
			eq(memoryEmbeddings.sourceType, input.sourceType),
			eq(memoryEmbeddings.sourceId, input.sourceId),
			eq(memoryEmbeddings.contentHash, contentHash),
			eq(memoryEmbeddings.embeddingModel, embeddingModel),
			eq(memoryEmbeddings.active, true)
		),
	});
	if (existing) {
		await db
			.update(memoryEmbeddings)
			.set({
				contentType: input.contentType ?? 'primary',
				userId: input.userId,
				characterId: input.characterId,
				sessionId: input.sessionId,
				content: input.content,
				metadata: input.metadata ?? {},
				updatedAt: new Date().toISOString(),
			})
			.where(eq(memoryEmbeddings.embeddingId, existing.embeddingId));
		return;
	}

	const vector = await createEmbeddingVector(input.content, embeddingModel);
	const now = new Date().toISOString();
	await db.transaction(async (tx) => {
		await tx
			.update(memoryEmbeddings)
			.set({ active: false, updatedAt: now })
			.where(
				and(
					eq(memoryEmbeddings.sourceType, input.sourceType),
					eq(memoryEmbeddings.sourceId, input.sourceId)
				)
			);
		await tx
			.insert(memoryEmbeddings)
			.values({
				embeddingId: randomUUID(),
				sourceType: input.sourceType,
				sourceId: input.sourceId,
				contentType: input.contentType ?? 'primary',
				userId: input.userId,
				characterId: input.characterId,
				sessionId: input.sessionId,
				content: input.content,
				contentHash,
				embeddingModel,
				embeddingVersion: 1,
				embedding: vector,
				metadata: input.metadata ?? {},
				active: true,
				createdAt: now,
				updatedAt: now,
			});
	});
};

export const deleteMemoryEmbeddings = async (
	sourceType: MemorySourceType,
	sourceId: string
): Promise<void> => {
	await getDatabase()
		.delete(memoryEmbeddings)
		.where(and(eq(memoryEmbeddings.sourceType, sourceType), eq(memoryEmbeddings.sourceId, sourceId)));
};

export const searchMemoryEmbeddings = async (
	queryTexts: string[],
	scope: MemorySearchScope,
	limit = 10,
	queryEmbeddingCache: QueryEmbeddingCache = createQueryEmbeddingCache(),
	ragTraceContext?: RagTraceContext
): Promise<MemorySearchResult[]> => {
	if (queryTexts.length === 0) return [];
	const db = getDatabase();
	const bestBySource = new Map<string, MemorySearchResult>();
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

		const rows = await db
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
			const result = {
				...row,
				sourceType: row.sourceType as MemorySourceType,
				metadata: row.metadata as Metadata,
			};
			const sourceKey = `${result.sourceType}:${result.sourceId}`;
			const current = bestBySource.get(sourceKey);
			if (!current || row.distance < current.distance) bestBySource.set(sourceKey, result);
		}
	}

	const selected = [...bestBySource.values()]
		.sort((a, b) => a.distance - b.distance)
		.slice(0, limit);
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
	options: { excludeSourceIds?: string[]; limit?: number } = {}
): Promise<MemoryKeywordSearchResult[]> => {
	const normalizedKeywords = [...new Set(keywords.map((keyword) => keyword.toLowerCase().trim()))]
		.filter((keyword) => keyword.length >= 2)
		.slice(0, 25);
	if (!normalizedKeywords.length) return [];

	const keywordCondition = or(
		...normalizedKeywords.map(
			(keyword) => sql`position(${keyword} in lower(${memoryEmbeddings.content})) > 0`
		)
	);
	if (!keywordCondition) return [];
	const hitScore = sql<number>`${sql.join(
		normalizedKeywords.map(
			(keyword) =>
				sql`case when position(${keyword} in lower(${memoryEmbeddings.content})) > 0 then 1 else 0 end`
		),
		sql` + `
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

	return getDatabase()
		.select({ sourceId: memoryEmbeddings.sourceId, content: memoryEmbeddings.content, hitScore })
		.from(memoryEmbeddings)
		.where(and(...conditions))
		.orderBy(
			desc(hitScore),
			asc(sql<number>`length(${memoryEmbeddings.sourceId})`),
			asc(memoryEmbeddings.sourceId)
		)
		.limit(options.limit ?? 100);
};
