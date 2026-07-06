import { and, asc, eq } from 'drizzle-orm';
import { Metadata } from '@rita-berenice/shared/api';
import { METADATA_TYPES } from '@rita-berenice/shared/config';
import { RecapInfo } from '@rita-berenice/shared/domain';
import { recapToMetadata } from '@rita-berenice/shared/util';
import { getDatabase } from '../db/postgresClient.js';
import { recaps } from '../db/schema.js';
import { replaceMemoryEmbedding, searchMemoryEmbeddings } from '../service/embeddingService.js';
import { recapToDocument } from '../util/documentUtils.js';
import { FilterCriteria } from '../util/schemaUtils.js';

type RecapType = typeof METADATA_TYPES.RECAP | typeof METADATA_TYPES.RELATIONSHIP;

export const recapStore = {
	async storeRecap(recapInfo: RecapInfo): Promise<{ recapId: string }> {
		if (!recapInfo.content?.trim()) return { recapId: '' };
		const now = new Date().toISOString();
		await getDatabase()
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
				set: {
					recapType: recapInfo.type,
					turnStart: recapInfo.turnStart,
					turnEnd: recapInfo.turnEnd,
					data: recapInfo,
					updatedAt: recapInfo.updatedAt || now,
				},
			});
		await replaceMemoryEmbedding({
			sourceType: 'recap',
			sourceId: recapInfo.recapId,
			userId: recapInfo.userId,
			characterId: recapInfo.characterId,
			sessionId: recapInfo.sessionId,
			content: recapToDocument(recapInfo),
			metadata: recapToMetadata(recapInfo) as unknown as Metadata,
		});
		return { recapId: recapInfo.recapId };
	},

	async getRecapsBySessionId(sessionId: string, type: RecapType): Promise<RecapInfo[]> {
		const rows = await getDatabase()
			.select({ data: recaps.data })
			.from(recaps)
			.where(and(eq(recaps.sessionId, sessionId), eq(recaps.recapType, type)))
			.orderBy(asc(recaps.turnStart));
		return rows.map((row) => row.data);
	},

	async queryRecaps(
		sessionId: string,
		queryTexts: string[],
		type: RecapType,
		filterCriteria?: FilterCriteria,
		_whereDocument?: unknown,
		limit = 10
	): Promise<RecapInfo[]> {
		const all = await recapStore.getRecapsBySessionId(sessionId, type);
		const requested = [
			...(filterCriteria?.keywords ?? []),
			...(filterCriteria?.topics ?? []),
			filterCriteria?.emotion,
		]
			.filter(Boolean)
			.map((value) => String(value).toLowerCase());
		const candidates = requested.length
			? all.filter((item) =>
					requested.some((value) => (item.flagList ?? []).some((flag) => flag.toLowerCase() === value))
				)
			: all;
		if (!candidates.length) return [];
		const results = await searchMemoryEmbeddings(
			queryTexts,
			{ sourceType: 'recap', sessionId, sourceIds: candidates.map((item) => item.recapId) },
			limit
		);
		const byId = new Map(candidates.map((item) => [item.recapId, item]));
		return results.map((result) => byId.get(result.sourceId)).filter(Boolean) as RecapInfo[];
	},
};
