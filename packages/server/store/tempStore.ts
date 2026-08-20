import { TempChatResponse } from '@rita-berenice/shared/api';
import { ApiError, TempChatTurn } from '@rita-berenice/shared/domain';
import { buildTempChatTurnId } from '@rita-berenice/shared/util';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { getDatabase } from '../db/postgresClient.js';
import { tempChatTurns } from '../db/schema.js';
import { handleServiceError } from '../util/serviceHelpers.js';

const toResponse = (turns: TempChatTurn[]): TempChatResponse => ({
	tempChatTurns: turns,
	tempChatTurn: turns[0] ?? null,
});

export const tempStore = {
	saveTempChatTurn: async (tempTurn: TempChatTurn): Promise<{ tempTurnId: string }> => {
		const now = new Date().toISOString();
		const updatedTurn: TempChatTurn = {
			...tempTurn,
			tempTurnId: tempTurn.tempTurnId || buildTempChatTurnId(tempTurn.sessionId, tempTurn.sequence),
			createdAt: tempTurn.createdAt || now,
			updatedAt: now,
			setCount: tempTurn.chatTurnSets.length,
		};
		try {
			await getDatabase()
				.insert(tempChatTurns)
				.values({
					sessionId: updatedTurn.sessionId,
					sequence: updatedTurn.sequence,
					userId: updatedTurn.userId,
					data: updatedTurn,
					createdAt: updatedTurn.createdAt,
					updatedAt: updatedTurn.updatedAt,
				})
				.onConflictDoUpdate({
					target: [tempChatTurns.sessionId, tempChatTurns.sequence],
					set: { userId: updatedTurn.userId, data: updatedTurn, updatedAt: updatedTurn.updatedAt },
				});
			return { tempTurnId: updatedTurn.tempTurnId };
		} catch (error) {
			handleServiceError(error, `Failed to store temp turn ${tempTurn.sessionId}`);
		}
	},

	getTempChatTurn: async (sessionId: string, sequence: number): Promise<TempChatResponse> => {
		try {
			const [row] = await getDatabase()
				.select({ data: tempChatTurns.data })
				.from(tempChatTurns)
				.where(and(eq(tempChatTurns.sessionId, sessionId), eq(tempChatTurns.sequence, sequence)))
				.limit(1);
			if (!row) throw new ApiError(404, 'Temporary chat turn not found.');
			return toResponse([row.data]);
		} catch (error) {
			handleServiceError(
				error,
				'Failed to get temporary chat turn.',
				`Error fetching temp turn for session ${sessionId}`,
				{ suppress404: true }
			);
		}
	},

	getLastTempTurnsForSessions: async (sessionIds: string[]): Promise<TempChatResponse> => {
		if (sessionIds.length === 0) return toResponse([]);
		try {
			const rows = await getDatabase()
				.select({ data: tempChatTurns.data })
				.from(tempChatTurns)
				.where(inArray(tempChatTurns.sessionId, sessionIds))
				.orderBy(desc(tempChatTurns.updatedAt));

			const latestBySession = new Map<string, TempChatTurn>();
			for (const row of rows) {
				if (!latestBySession.has(row.data.sessionId)) {
					latestBySession.set(row.data.sessionId, row.data);
				}
			}
			return toResponse([...latestBySession.values()]);
		} catch (error) {
			handleServiceError(error, 'Failed to fetch recent temporary chat turns.');
		}
	},

	deleteTempChatTurn: async (sessionId: string, sequence: number): Promise<void> => {
		try {
			await getDatabase()
				.delete(tempChatTurns)
				.where(and(eq(tempChatTurns.sessionId, sessionId), eq(tempChatTurns.sequence, sequence)));
		} catch (error) {
			handleServiceError(error, `Failed to delete temp turn ${sessionId}/${sequence}.`);
		}
	},

	clearTempChatCollectionCache: (): void => {},
};
