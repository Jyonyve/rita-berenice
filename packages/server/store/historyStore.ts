import { eq } from 'drizzle-orm';
import { HistoryResponse, Metadata } from '@rita-berenice/shared/api';
import { HistoryInfo } from '@rita-berenice/shared/domain';
import { historyToMetadata } from '@rita-berenice/shared/util';
import { getDatabase } from '../db/postgresClient.js';
import { histories } from '../db/schema.js';
import {
	deleteMemoryEmbeddings,
	replaceMemoryEmbedding,
	searchMemoryEmbeddings,
} from '../service/embeddingService.js';
import { historyToDocument } from '../util/documentUtils.js';
import { FilterCriteria } from '../util/schemaUtils.js';

const emptyResponse = (): HistoryResponse => ({
	ids: [],
	metadatas: [],
	documents: [],
	historyInfo: {} as HistoryInfo,
	historyContent: '',
	historyInfos: [],
	historyContents: [],
});

const toResponse = (items: HistoryInfo[]): HistoryResponse => ({
	ids: items.map((item) => item.historyId),
	metadatas: items.map((item) => historyToMetadata(item) as unknown as Metadata),
	documents: items.map(historyToDocument),
	historyInfo: items[0] ?? ({} as HistoryInfo),
	historyContent: items[0]?.content ?? '',
	historyInfos: items,
	historyContents: items.map((item) => item.content),
});

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
		await replaceMemoryEmbedding({
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
		return row ? toResponse([row.data]) : emptyResponse();
	},

	getHistories: async (characterId: string): Promise<HistoryResponse> => {
		const rows = await getDatabase()
			.select({ data: histories.data })
			.from(histories)
			.where(eq(histories.characterId, characterId));
		return toResponse(rows.map((row) => row.data));
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
		limit = 10
	): Promise<HistoryResponse> => {
		const rows = await getDatabase()
			.select({ data: histories.data })
			.from(histories)
			.where(eq(histories.characterId, characterId));
		const candidates = rows
			.map((row) => row.data)
			.filter((item) => matchesCriteria(item, filterCriteria));
		if (!candidates.length) return emptyResponse();
		const results = await searchMemoryEmbeddings(
			queryTexts,
			{ sourceType: 'history', characterId, sourceIds: candidates.map((item) => item.historyId) },
			limit
		);
		const byId = new Map(candidates.map((item) => [item.historyId, item]));
		return toResponse(
			results.map((result) => byId.get(result.sourceId)).filter(Boolean) as HistoryInfo[]
		);
	},

	clearCollectionCache: (): void => {},
};
