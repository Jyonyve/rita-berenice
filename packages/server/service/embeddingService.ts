import { createHash, randomUUID } from 'node:crypto';
import OpenAI from 'openai';
import { and, asc, cosineDistance, eq, inArray, sql } from 'drizzle-orm';
import { Metadata } from '@rita-berenice/shared/api';
import { getEmbeddingEnv } from '../config/env.js';
import { getDatabase } from '../db/postgresClient.js';
import { memoryEmbeddings } from '../db/schema.js';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

export type MemorySourceType = 'chat' | 'lore' | 'history' | 'recap';

export interface MemorySearchScope {
	sourceType: MemorySourceType;
	userId?: string;
	characterId?: string;
	sessionId?: string;
	sourceIds?: string[];
}

export interface MemorySearchResult {
	sourceId: string;
	content: string;
	metadata: Metadata;
	distance: number;
}

let openai: OpenAI | undefined;

const getOpenAI = () => {
	openai ??= new OpenAI({ apiKey: getEmbeddingEnv().OPENAI_API_KEY });
	return openai;
};

const embed = async (input: string): Promise<number[]> => {
	const response = await getOpenAI().embeddings.create({
		model: EMBEDDING_MODEL,
		input,
		dimensions: EMBEDDING_DIMENSIONS,
		encoding_format: 'float',
	});
	return response.data[0].embedding;
};

export const replaceMemoryEmbedding = async (input: {
	sourceType: MemorySourceType;
	sourceId: string;
	contentType?: string;
	userId: string;
	characterId?: string;
	sessionId?: string;
	content: string;
	metadata?: Metadata;
}): Promise<void> => {
	const db = getDatabase();
	const contentHash = createHash('sha256').update(input.content).digest('hex');
	const existing = await db.query.memoryEmbeddings.findFirst({
		where: and(
			eq(memoryEmbeddings.sourceType, input.sourceType),
			eq(memoryEmbeddings.sourceId, input.sourceId),
			eq(memoryEmbeddings.contentHash, contentHash),
			eq(memoryEmbeddings.active, true)
		),
	});
	if (existing) {
		await db
			.update(memoryEmbeddings)
			.set({ metadata: input.metadata ?? {}, updatedAt: new Date().toISOString() })
			.where(eq(memoryEmbeddings.embeddingId, existing.embeddingId));
		return;
	}

	const vector = await embed(input.content);
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
				embeddingModel: EMBEDDING_MODEL,
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
	limit = 10
): Promise<MemorySearchResult[]> => {
	if (queryTexts.length === 0) return [];
	const db = getDatabase();
	const bestBySource = new Map<string, MemorySearchResult>();

	for (const queryText of queryTexts) {
		const queryEmbedding = await embed(queryText);
		const distance = cosineDistance(memoryEmbeddings.embedding, queryEmbedding);
		const conditions = [
			eq(memoryEmbeddings.sourceType, scope.sourceType),
			eq(memoryEmbeddings.active, true),
		];
		if (scope.userId) conditions.push(eq(memoryEmbeddings.userId, scope.userId));
		if (scope.characterId) conditions.push(eq(memoryEmbeddings.characterId, scope.characterId));
		if (scope.sessionId) conditions.push(eq(memoryEmbeddings.sessionId, scope.sessionId));
		if (scope.sourceIds?.length) conditions.push(inArray(memoryEmbeddings.sourceId, scope.sourceIds));

		const rows = await db
			.select({
				sourceId: memoryEmbeddings.sourceId,
				content: memoryEmbeddings.content,
				metadata: memoryEmbeddings.metadata,
				distance: sql<number>`${distance}`,
			})
			.from(memoryEmbeddings)
			.where(and(...conditions))
			.orderBy(asc(distance))
			.limit(Math.min(limit * 3, 50));

		for (const row of rows) {
			const result = { ...row, metadata: row.metadata as Metadata };
			const current = bestBySource.get(row.sourceId);
			if (!current || row.distance < current.distance) bestBySource.set(row.sourceId, result);
		}
	}

	return [...bestBySource.values()].sort((a, b) => a.distance - b.distance).slice(0, limit);
};
