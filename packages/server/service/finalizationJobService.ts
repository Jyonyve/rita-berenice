import {
	EnqueueFinalizationResponse,
	FinalizationJobSnapshot,
	FinalizationJobStatus,
} from '@rita-berenice/shared/api';
import { ChatTurn, ChatTurnCdo, DisplayTurn } from '@rita-berenice/shared/domain';
import { buildChatTurnId, createBasicChatTurn } from '@rita-berenice/shared/util';
import { asc, eq, inArray } from 'drizzle-orm';
import { getDatabase } from '../db/postgresClient.js';
import { finalizationJobs } from '../db/schema.js';
import { chatStore } from '../store/chatStore.js';
import { BackgroundJobQueue } from '../util/backgroundJobQueue.js';
import { flowLogger, serializeError } from '../util/jsonlLogger.js';
import { enrichChatTurn } from './orchestrationService.js';

const FINALIZATION_MAX_ATTEMPTS = 3;
const PENDING_FINALIZATION_STATUSES: FinalizationJobStatus[] = ['queued', 'running', 'retrying'];

const enrichedTurnCache = new Map<string, ChatTurn>();

const toDisplayTurn = (turn: ChatTurn): DisplayTurn => ({
	chatTurnId: turn.chatTurnId,
	sessionId: turn.sessionId,
	characterId: turn.characterId,
	userId: turn.userId,
	profileId: turn.profileId,
	sequence: turn.sequence,
	createdAt: turn.createdAt,
	updatedAt: turn.updatedAt,
	request: turn.request,
	response: turn.response,
});

const persistFinalizationJob = async (
	job: FinalizationJobSnapshot,
	input: ChatTurnCdo
): Promise<void> => {
	const now = new Date().toISOString();
	await getDatabase()
		.insert(finalizationJobs)
		.values({
			jobId: job.jobId,
			sessionId: input.sessionId,
			sequence: input.sequence,
			status: job.status,
			attempts: job.attempts,
			maxAttempts: job.maxAttempts,
			input,
			result: job.result ?? null,
			error: job.error ?? null,
			lockedAt: job.status === 'running' || job.status === 'retrying' ? now : null,
			createdAt: job.createdAt,
			updatedAt: job.updatedAt,
		})
		.onConflictDoUpdate({
			target: finalizationJobs.jobId,
			set: {
				status: job.status,
				attempts: job.attempts,
				maxAttempts: job.maxAttempts,
				input,
				result: job.result ?? null,
				error: job.error ?? null,
				lockedAt: job.status === 'running' || job.status === 'retrying' ? now : null,
				updatedAt: job.updatedAt,
			},
		});
};

const findPersistedJob = async (jobId: string): Promise<FinalizationJobSnapshot | undefined> => {
	const row = await getDatabase().query.finalizationJobs.findFirst({
		where: eq(finalizationJobs.jobId, jobId),
	});
	if (!row) return undefined;
	return {
		jobId: row.jobId,
		status: row.status as FinalizationJobStatus,
		attempts: row.attempts,
		maxAttempts: row.maxAttempts,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		result: row.result ?? undefined,
		error: row.error ?? undefined,
	};
};

const findPersistedJobInput = async (jobId: string): Promise<ChatTurnCdo | undefined> => {
	const row = await getDatabase().query.finalizationJobs.findFirst({
		where: eq(finalizationJobs.jobId, jobId),
	});
	return row?.input as ChatTurnCdo | undefined;
};

const finalizationQueue = new BackgroundJobQueue<ChatTurnCdo, ChatTurn>({
	worker: async (chatTurnCdo) => {
		const chatTurnId = buildChatTurnId(chatTurnCdo.sessionId, chatTurnCdo.sequence);
		let enrichedTurn = enrichedTurnCache.get(chatTurnId);
		if (!enrichedTurn) {
			enrichedTurn = await enrichChatTurn(chatTurnCdo);
			if (enrichedTurnCache.size >= 500) {
				const oldestKey = enrichedTurnCache.keys().next().value;
				if (oldestKey) enrichedTurnCache.delete(oldestKey);
			}
			enrichedTurnCache.set(chatTurnId, enrichedTurn);
		}

		await chatStore.storeChatTurn(enrichedTurn);
		enrichedTurnCache.delete(chatTurnId);
		return enrichedTurn;
	},
	maxAttempts: FINALIZATION_MAX_ATTEMPTS,
	retryDelayMs: 500,
	maxRetainedJobs: 500,
	onChange: persistFinalizationJob,
	onChangeError: (error, snapshot, input) => {
		flowLogger.error('finalizationJobService', 'job.persist.failed', {
			jobId: snapshot.jobId,
			status: snapshot.status,
			attempts: snapshot.attempts,
			sessionId: input.sessionId,
			turn: input.sequence,
			...serializeError(error),
		});
	},
});

const findFinalizedTurn = async (chatTurnId: string): Promise<ChatTurn | undefined> => {
	if (!(await chatStore.hasChatTurn(chatTurnId))) return undefined;
	const response = await chatStore.getChatTurn(chatTurnId);
	return response.chatTurns[0];
};

export const finalizationJobService = {
	async enqueue(chatTurnCdo: ChatTurnCdo): Promise<EnqueueFinalizationResponse> {
		const basicTurn = createBasicChatTurn(chatTurnCdo);
		const existingJob = finalizationQueue.get(basicTurn.chatTurnId);
		if (existingJob && existingJob.status !== 'failed') {
			return { job: existingJob, displayTurn: toDisplayTurn(existingJob.result ?? basicTurn) };
		}

		const persistedJob = await findPersistedJob(basicTurn.chatTurnId);
		if (persistedJob && persistedJob.status !== 'failed') {
			if (
				persistedJob.status === 'queued' ||
				persistedJob.status === 'running' ||
				persistedJob.status === 'retrying'
			) {
				const persistedInput = await findPersistedJobInput(basicTurn.chatTurnId);
				const job = persistedInput
					? finalizationQueue.enqueue(basicTurn.chatTurnId, persistedInput)
					: persistedJob;
				return { job, displayTurn: toDisplayTurn(job.result ?? basicTurn) };
			}
			return { job: persistedJob, displayTurn: toDisplayTurn(persistedJob.result ?? basicTurn) };
		}

		const finalizedTurn = await findFinalizedTurn(basicTurn.chatTurnId);
		const job = finalizedTurn
			? finalizationQueue.recordCompleted(basicTurn.chatTurnId, chatTurnCdo, finalizedTurn)
			: finalizationQueue.enqueue(basicTurn.chatTurnId, chatTurnCdo);
		await persistFinalizationJob(job, chatTurnCdo);

		return { job, displayTurn: toDisplayTurn(finalizedTurn ?? basicTurn) };
	},

	async get(sessionId: string, sequence: number): Promise<FinalizationJobSnapshot | undefined> {
		const jobId = buildChatTurnId(sessionId, sequence);
		const existingJob = finalizationQueue.get(jobId);
		if (existingJob) return existingJob;

		const persistedJob = await findPersistedJob(jobId);
		if (persistedJob) {
			if (
				persistedJob.status === 'queued' ||
				persistedJob.status === 'running' ||
				persistedJob.status === 'retrying'
			) {
				const input = await findPersistedJobInput(jobId);
				if (input) return finalizationQueue.enqueue(jobId, input);
			}
			return persistedJob;
		}

		const finalizedTurn = await findFinalizedTurn(jobId);
		if (!finalizedTurn) return undefined;

		return {
			jobId,
			status: 'completed',
			attempts: 0,
			maxAttempts: FINALIZATION_MAX_ATTEMPTS,
			createdAt: finalizedTurn.createdAt,
			updatedAt: finalizedTurn.updatedAt,
			result: finalizedTurn,
		};
	},

	async resumePendingJobs(limit = 50): Promise<number> {
		const rows = await getDatabase()
			.select({ jobId: finalizationJobs.jobId, input: finalizationJobs.input })
			.from(finalizationJobs)
			.where(inArray(finalizationJobs.status, PENDING_FINALIZATION_STATUSES))
			.orderBy(asc(finalizationJobs.updatedAt))
			.limit(limit);

		let enqueuedCount = 0;
		for (const row of rows) {
			const input = row.input as ChatTurnCdo | undefined;
			if (!input) continue;
			finalizationQueue.enqueue(row.jobId, input);
			enqueuedCount += 1;
		}
		return enqueuedCount;
	},
};
