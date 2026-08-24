import { and, eq, inArray } from 'drizzle-orm';
import { HistoryResponse, Metadata } from '@rita-berenice/shared/api';
import { HistoryInfo } from '@rita-berenice/shared/domain';
import { historyToMetadata } from '@rita-berenice/shared/util';
import { getDatabase } from '../db/postgresClient.js';
import { histories } from '../db/schema.js';
import {
	deleteMemoryEmbeddings,
	QueryEmbeddingCache,
	searchMemoryEmbeddings,
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
		items.map(
			async (item) =>
				[item.historyId, await getHistoryImageUrl(item.characterId, item.historyId)] as const
		)
	);

	return {
		historyInfo: items[0] ?? ({} as HistoryInfo),
		historyContent: items[0]?.content ?? '',
		historyInfos: items,
		historyContents: items.map((item) => item.content),
		historyImageUrls: Object.fromEntries(
			imageEntries.filter((entry): entry is readonly [string, string] => Boolean(entry[1]))
		),
	};
};

const matchesCriteria = (item: HistoryInfo, criteria?: FilterCriteria) => {
	if (!criteria) return true;
	const searchable = [
		...(item.keywordList ?? []),
		...(item.topicList ?? []),
		...(item.entityList ?? []),
		...(item.allAffectedCharacterIdList ?? []),
	].map((value) => String(value).toLowerCase());
	const requested = [
		...(criteria.keywords ?? []),
		...(criteria.topics ?? []),
		...(criteria.entities?.characters ?? []),
		...(criteria.entities?.locations ?? []),
		...(criteria.entities?.items ?? []),
	].map((value) => value.toLowerCase());
	return requested.length === 0 || requested.some((value) => searchable.includes(value));
};

export const historyStore = {
	storeHistory: async (historyInfo: HistoryInfo): Promise<{ historyId: string }> => {
		const now = new Date().toISOString();
		await getDatabase()
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
				set: {
					characterId: historyInfo.characterId,
					userId: historyInfo.userId,
					category: historyInfo.category,
					data: historyInfo,
					updatedAt: historyInfo.updatedAt || now,
				},
			});
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

	getHistory: async (historyId: string): Promise<HistoryResponse> => {
		const row = await getDatabase().query.histories.findFirst({
			where: eq(histories.historyId, historyId),
		});
		return row ? await toResponse([row.data]) : emptyResponse();
	},

	getHistories: async (characterId: string): Promise<HistoryResponse> => {
		const rows = await getDatabase()
			.select({ data: histories.data })
			.from(histories)
			.where(eq(histories.characterId, characterId));
		return await toResponse(rows.map((row) => row.data));
	},

	deleteHistory: async (historyId: string): Promise<void> => {
		await getDatabase().delete(histories).where(eq(histories.historyId, historyId));
		await deleteMemoryEmbeddings('history', historyId);
	},

	queryHistories: async (
		characterId: string,
		queryTexts: string[],
		filterCriteria?: FilterCriteria,
		_whereDocument?: unknown,
		limit = 10,
		queryEmbeddingCache?: QueryEmbeddingCache,
		ragTraceContext?: RagTraceContext
	): Promise<HistoryResponse> => {
		const rows = await getDatabase()
			.select({ data: histories.data })
			.from(histories)
			.where(eq(histories.characterId, characterId));
		const items = rows.map((row) => row.data);
		// Criteria values are LLM-extracted and normalized to English, while the metadata
		// lists they are matched against follow the data's own language. An exact-match
		// miss therefore says nothing about relevance, so an empty pre-filter falls open
		// instead of skipping vector search entirely.
		const matched = items.filter((item) => matchesCriteria(item, filterCriteria));
		const candidates = matched.length > 0 ? matched : items;
		if (!candidates.length) return emptyResponse();
		const results = await searchMemoryEmbeddings(
			queryTexts,
			{ sourceType: 'history', characterId, sourceIds: candidates.map((item) => item.historyId) },
			limit,
			queryEmbeddingCache,
			ragTraceContext
		);
		const byId = new Map(candidates.map((item) => [item.historyId, item]));
		return await toResponse(
			results.map((result) => byId.get(result.sourceId)).filter(Boolean) as HistoryInfo[]
		);
	},

	// Mirrors chatStore.queryChatTurnsByKeywords / recapStore.queryRecapsByKeywords: a
	// keyword pass over the embedded Korean document text rescues retrieval when the
	// semantic search missed. History is character-scoped because it has no session.
	queryHistoriesByKeywords: async (
		characterId: string,
		keywords: string[],
		excludeIds: string[] = [],
		limit = 100
	): Promise<HistoryResponse> => {
		const embeddingRows = await searchMemoryEmbeddingsByKeywords(
			keywords,
			{ sourceType: 'history', characterId },
			{ excludeSourceIds: excludeIds, limit }
		);
		const sourceIds = embeddingRows.map((row) => row.sourceId);
		if (!sourceIds.length) return emptyResponse();

		const rows = await getDatabase()
			.select({ data: histories.data })
			.from(histories)
			.where(and(eq(histories.characterId, characterId), inArray(histories.historyId, sourceIds)))
			.limit(sourceIds.length);
		const byId = new Map(rows.map((row) => [row.data.historyId, row.data]));
		return toResponse(
			sourceIds.map((sourceId) => byId.get(sourceId)).filter(Boolean) as HistoryInfo[]
		);
	},

	clearCollectionCache: (): void => {},
};
