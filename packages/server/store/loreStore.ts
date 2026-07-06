import { and, eq } from 'drizzle-orm';
import { LoreResponse, Metadata } from '@rita-berenice/shared/api';
import { LoreInfo } from '@rita-berenice/shared/domain';
import { loreToMetadata } from '@rita-berenice/shared/util';
import { getDatabase } from '../db/postgresClient.js';
import { lores } from '../db/schema.js';
import {
	deleteMemoryEmbeddings,
	replaceMemoryEmbedding,
	searchMemoryEmbeddings,
} from '../service/embeddingService.js';
import { loreToDocument } from '../util/documentUtils.js';
import { FilterCriteria } from '../util/schemaUtils.js';

const emptyResponse = (): LoreResponse => ({
	ids: [],
	metadatas: [],
	documents: [],
	loreInfo: {} as LoreInfo,
	loreContent: '',
	loreInfos: [],
	loreContents: [],
});

const toResponse = (items: LoreInfo[]): LoreResponse => ({
	ids: items.map((item) => item.loreId),
	metadatas: items.map((item) => loreToMetadata(item) as unknown as Metadata),
	documents: items.map(loreToDocument),
	loreInfo: items[0] ?? ({} as LoreInfo),
	loreContent: items[0]?.content ?? '',
	loreInfos: items,
	loreContents: items.map((item) => item.content),
});

const matchesCriteria = (item: LoreInfo, criteria?: FilterCriteria) => {
	if (!criteria) return true;
	const searchable = [
		...(item.keywordList ?? []),
		...(item.topicList ?? []),
		...(item.entityList ?? []),
		...(item.characterIds ?? []),
	].map((value) => value.toLowerCase());
	const requested = [
		...(criteria.keywords ?? []),
		...(criteria.topics ?? []),
		...(criteria.entities?.characters ?? []),
		...(criteria.entities?.locations ?? []),
		...(criteria.entities?.items ?? []),
	].map((value) => value.toLowerCase());
	return requested.length === 0 || requested.some((value) => searchable.includes(value));
};

export const loreStore = {
	storeLore: async (loreInfo: LoreInfo): Promise<{ loreId: string }> => {
		const now = new Date().toISOString();
		await getDatabase()
			.insert(lores)
			.values({
				loreId: loreInfo.loreId,
				userId: loreInfo.userId,
				loreType: loreInfo.type,
				category: loreInfo.category,
				data: loreInfo,
				createdAt: loreInfo.createdAt || now,
				updatedAt: loreInfo.updatedAt || now,
			})
			.onConflictDoUpdate({
				target: lores.loreId,
				set: {
					userId: loreInfo.userId,
					loreType: loreInfo.type,
					category: loreInfo.category,
					data: loreInfo,
					updatedAt: loreInfo.updatedAt || now,
				},
			});
		await replaceMemoryEmbedding({
			sourceType: 'lore',
			sourceId: loreInfo.loreId,
			userId: loreInfo.userId,
			content: loreToDocument(loreInfo),
			metadata: loreToMetadata(loreInfo) as unknown as Metadata,
		});
		return { loreId: loreInfo.loreId };
	},

	getLore: async (loreId: string): Promise<LoreResponse> => {
		const row = await getDatabase().query.lores.findFirst({ where: eq(lores.loreId, loreId) });
		return row ? toResponse([row.data]) : emptyResponse();
	},

	getLoresByCharacter: async (characterId: string): Promise<LoreResponse> => {
		const rows = await getDatabase().select({ data: lores.data }).from(lores);
		return toResponse(
			rows.map((row) => row.data).filter((item) => item.characterIds.includes(characterId))
		);
	},

	getWorldLores: async (userId?: string): Promise<LoreResponse> => {
		const conditions = [eq(lores.category, 'World')];
		if (userId) conditions.push(eq(lores.userId, userId));
		const rows = await getDatabase()
			.select({ data: lores.data })
			.from(lores)
			.where(and(...conditions));
		return toResponse(rows.map((row) => row.data));
	},

	deleteLore: async (loreId: string): Promise<void> => {
		await getDatabase().delete(lores).where(eq(lores.loreId, loreId));
		await deleteMemoryEmbeddings('lore', loreId);
	},

	queryLores: async (
		characterIds: string | string[],
		queryTexts: string[],
		filterCriteria?: FilterCriteria,
		_whereDocument?: unknown,
		limit = 10
	): Promise<LoreResponse> => {
		const ids = Array.isArray(characterIds) ? characterIds : [characterIds];
		const rows = await getDatabase().select({ data: lores.data }).from(lores);
		const candidates = rows
			.map((row) => row.data)
			.filter(
				(item) =>
					item.category === 'World' ||
					item.characterIds.some((id) => ids.includes(id)) ||
					matchesCriteria(item, filterCriteria)
			);
		if (!candidates.length) return emptyResponse();
		const results = await searchMemoryEmbeddings(
			queryTexts,
			{ sourceType: 'lore', sourceIds: candidates.map((item) => item.loreId) },
			limit
		);
		const byId = new Map(candidates.map((item) => [item.loreId, item]));
		return toResponse(
			results.map((result) => byId.get(result.sourceId)).filter(Boolean) as LoreInfo[]
		);
	},

	clearCollectionCache: (): void => {},
};
