import {
	EnqueueFinalizationResponse,
	FinalizationJobSnapshot,
	FinalizationJobStatus,
} from '@rita-berenice/shared/api';
import {
	ApiKeyError,
	ApiKeyType,
	ChatTurn,
	ChatTurnCdo,
	DisplayTurn,
} from '@rita-berenice/shared/domain';
import { buildChatTurnId, createBasicChatTurn } from '@rita-berenice/shared/util';
import { and, asc, eq, gte, inArray, lt, or, sql } from 'drizzle-orm';
import { getDatabase } from '../db/postgresClient.js';
import { finalizationJobs } from '../db/schema.js';
import { chatStore } from '../store/chatStore.js';
import {
	BackgroundJobErrorMeta,
	BackgroundJobQueue,
	BackgroundJobSnapshot,
} from '../util/backgroundJobQueue.js';
import { flowLogger, serializeError } from '../util/jsonlLogger.js';
import { enrichChatTurn } from './orchestrationService.js';

const FINALIZATION_MAX_ATTEMPTS = 3;
const PENDING_FINALIZATION_STATUSES: FinalizationJobStatus[] = ['queued', 'running', 'retrying'];

/**
 * Guards on resuming failed jobs at startup.
 *
 * Failed jobs are resumed because the common failure - a missing API key the user has since
 * registered - is entirely recoverable. The failures that are not recoverable are the expensive
 * ones: an exhausted quota or a revoked key issues a real, billable provider call on every
 * restart. So a failed job is only picked back up while it is both recent and has not already
 * been resumed several times.
 */
const MAX_FAILED_RESUME_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_FAILED_RESUME_COUNT = 3;

/**
 * A stored turn is not proof that finalization finished.
 *
 * The worker now writes the unenriched turn before enrichment runs, so the presence of a row in
 * `chat_turns` says only "the message survived". Treating that as completion would silently mark
 * every turn whose enrichment failed as done, and the user would never get the metadata back.
 * The sentinel is the shape `createBasicChatTurn` produces: empty summary and memory chunk.
 * `parseUtils` renders those as 'N/A' when building prompts, so both forms count as unenriched.
 */
const isEnrichedChatTurn = (turn: ChatTurn): boolean => {
	const isFilled = (value?: string): boolean => {
		const trimmed = value?.trim();
		return Boolean(trimmed) && trimmed !== 'N/A';
	};
	return isFilled(turn.summary) || isFilled(turn.memoryChunk);
};

const readApiKeyErrorMeta = (error: unknown): BackgroundJobErrorMeta | undefined =>
	error instanceof ApiKeyError ? { code: error.code, keyType: error.keyType } : undefined;

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

const toFinalizationSnapshot = (job: BackgroundJobSnapshot<ChatTurn>): FinalizationJobSnapshot => ({
	jobId: job.jobId,
	status: job.status,
	attempts: job.attempts,
	maxAttempts: job.maxAttempts,
	createdAt: job.createdAt,
	updatedAt: job.updatedAt,
	result: job.result,
	error: job.error,
	errorCode: job.errorMeta?.code,
	keyType: job.errorMeta?.keyType as ApiKeyType | undefined,
});

export interface ResumableFinalizationJob {
	jobId: string;
	input: ChatTurnCdo;
}

/**
 * Everything the service touches outside itself. Injected so the ordering and completion rules
 * below can be tested without a database or a live LLM - they are the parts that, when wrong,
 * lose a user's message.
 */
export interface FinalizationJobDeps {
	storeChatTurn: (turn: ChatTurn) => Promise<unknown>;
	getStoredTurn: (chatTurnId: string) => Promise<ChatTurn | undefined>;
	enrichChatTurn: (basicTurn: ChatTurn) => Promise<ChatTurn>;
	persistJob: (job: FinalizationJobSnapshot, input: ChatTurnCdo) => Promise<void>;
	readPersistedJob: (
		jobId: string
	) => Promise<{ job: FinalizationJobSnapshot; input?: ChatTurnCdo } | undefined>;
	listResumableJobs: (limit: number) => Promise<ResumableFinalizationJob[]>;
	markResumed: (jobIds: string[]) => Promise<void>;
}

const persistFinalizationJob = async (
	job: FinalizationJobSnapshot,
	input: ChatTurnCdo
): Promise<void> => {
	const now = new Date().toISOString();
	const lockedAt = job.status === 'running' || job.status === 'retrying' ? now : null;
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
			errorCode: job.errorCode ?? null,
			keyType: job.keyType ?? null,
			lockedAt,
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
				errorCode: job.errorCode ?? null,
				keyType: job.keyType ?? null,
				lockedAt,
				updatedAt: job.updatedAt,
			},
		});
};

const rowToSnapshot = (row: typeof finalizationJobs.$inferSelect): FinalizationJobSnapshot => ({
	jobId: row.jobId,
	status: row.status as FinalizationJobStatus,
	attempts: row.attempts,
	maxAttempts: row.maxAttempts,
	createdAt: row.createdAt,
	updatedAt: row.updatedAt,
	result: row.result ?? undefined,
	error: row.error ?? undefined,
	errorCode: row.errorCode ?? undefined,
	keyType: (row.keyType as ApiKeyType | null) ?? undefined,
});

export const databaseFinalizationJobDeps: FinalizationJobDeps = {
	storeChatTurn: (turn) => chatStore.storeChatTurn(turn),

	getStoredTurn: async (chatTurnId) => {
		if (!(await chatStore.hasChatTurn(chatTurnId))) return undefined;
		const response = await chatStore.getChatTurn(chatTurnId);
		return response.chatTurns[0];
	},

	enrichChatTurn: (basicTurn) => enrichChatTurn(basicTurn),

	persistJob: persistFinalizationJob,

	readPersistedJob: async (jobId) => {
		const row = await getDatabase().query.finalizationJobs.findFirst({
			where: eq(finalizationJobs.jobId, jobId),
		});
		if (!row) return undefined;
		return { job: rowToSnapshot(row), input: row.input as ChatTurnCdo | undefined };
	},

	listResumableJobs: async (limit) => {
		const failedResumeCutoff = new Date(Date.now() - MAX_FAILED_RESUME_AGE_MS).toISOString();
		const rows = await getDatabase()
			.select({ jobId: finalizationJobs.jobId, input: finalizationJobs.input })
			.from(finalizationJobs)
			.where(
				or(
					inArray(finalizationJobs.status, PENDING_FINALIZATION_STATUSES),
					and(
						eq(finalizationJobs.status, 'failed'),
						gte(finalizationJobs.updatedAt, failedResumeCutoff),
						lt(finalizationJobs.resumeCount, MAX_FAILED_RESUME_COUNT)
					)
				)
			)
			.orderBy(asc(finalizationJobs.updatedAt))
			.limit(limit);

		return rows
			.filter((row): row is { jobId: string; input: ChatTurnCdo } => Boolean(row.input))
			.map((row) => ({ jobId: row.jobId, input: row.input }));
	},

	markResumed: async (jobIds) => {
		if (!jobIds.length) return;
		await getDatabase()
			.update(finalizationJobs)
			.set({ resumeCount: sql`${finalizationJobs.resumeCount} + 1` })
			.where(inArray(finalizationJobs.jobId, jobIds));
	},
};

export const createFinalizationJobService = (
	deps: FinalizationJobDeps = databaseFinalizationJobDeps
) => {
	const enrichedTurnCache = new Map<string, ChatTurn>();

	const queue = new BackgroundJobQueue<ChatTurnCdo, ChatTurn>({
		worker: async (chatTurnCdo) => {
			const basicTurn = createBasicChatTurn(chatTurnCdo);
			const chatTurnId = basicTurn.chatTurnId;

			let enrichedTurn = enrichedTurnCache.get(chatTurnId);
			if (!enrichedTurn) {
				// Store the plain turn before enrichment is attempted. Enrichment used to run first,
				// so a failure there - a missing API key, most recently - threw before the message was
				// ever written and the user's own words were lost while the reply had already been
				// shown to them. The write is an idempotent upsert, so repeating it is free, and the
				// embedding is not recomputed: `chatTurnToDocument` reads only entries and showName,
				// which enrichment never changes, so the enriched re-store hits the identical
				// contentHash and only refreshes metadata.
				await deps.storeChatTurn(basicTurn);

				// Rethrows on failure, which keeps the existing three attempts and the failed status.
				enrichedTurn = await deps.enrichChatTurn(basicTurn);
				if (enrichedTurnCache.size >= 500) {
					const oldestKey = enrichedTurnCache.keys().next().value;
					if (oldestKey) enrichedTurnCache.delete(oldestKey);
				}
				enrichedTurnCache.set(chatTurnId, enrichedTurn);
			}

			await deps.storeChatTurn(enrichedTurn);
			enrichedTurnCache.delete(chatTurnId);
			return enrichedTurn;
		},
		maxAttempts: FINALIZATION_MAX_ATTEMPTS,
		retryDelayMs: 500,
		maxRetainedJobs: 500,
		readErrorMeta: readApiKeyErrorMeta,
		onChange: (snapshot, input) => deps.persistJob(toFinalizationSnapshot(snapshot), input),
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

	/** Only a fully enriched stored turn counts as a finished finalization. */
	const findFinalizedTurn = async (chatTurnId: string): Promise<ChatTurn | undefined> => {
		const turn = await deps.getStoredTurn(chatTurnId);
		return turn && isEnrichedChatTurn(turn) ? turn : undefined;
	};

	return {
		async enqueue(chatTurnCdo: ChatTurnCdo): Promise<EnqueueFinalizationResponse> {
			const basicTurn = createBasicChatTurn(chatTurnCdo);
			const existingJob = queue.get(basicTurn.chatTurnId);
			if (existingJob && existingJob.status !== 'failed') {
				const job = toFinalizationSnapshot(existingJob);
				return { job, displayTurn: toDisplayTurn(job.result ?? basicTurn) };
			}

			const persisted = await deps.readPersistedJob(basicTurn.chatTurnId);
			if (persisted && persisted.job.status !== 'failed') {
				if (PENDING_FINALIZATION_STATUSES.includes(persisted.job.status)) {
					const job = persisted.input
						? toFinalizationSnapshot(queue.enqueue(basicTurn.chatTurnId, persisted.input))
						: persisted.job;
					return { job, displayTurn: toDisplayTurn(job.result ?? basicTurn) };
				}
				return { job: persisted.job, displayTurn: toDisplayTurn(persisted.job.result ?? basicTurn) };
			}

			const finalizedTurn = await findFinalizedTurn(basicTurn.chatTurnId);
			const job = toFinalizationSnapshot(
				finalizedTurn
					? queue.recordCompleted(basicTurn.chatTurnId, chatTurnCdo, finalizedTurn)
					: queue.enqueue(basicTurn.chatTurnId, chatTurnCdo)
			);
			await deps.persistJob(job, chatTurnCdo);

			return { job, displayTurn: toDisplayTurn(finalizedTurn ?? basicTurn) };
		},

		async get(sessionId: string, sequence: number): Promise<FinalizationJobSnapshot | undefined> {
			const jobId = buildChatTurnId(sessionId, sequence);
			const existingJob = queue.get(jobId);
			if (existingJob) return toFinalizationSnapshot(existingJob);

			const persisted = await deps.readPersistedJob(jobId);
			if (persisted) {
				if (PENDING_FINALIZATION_STATUSES.includes(persisted.job.status) && persisted.input) {
					return toFinalizationSnapshot(queue.enqueue(jobId, persisted.input));
				}
				return persisted.job;
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
			const resumable = await deps.listResumableJobs(limit);
			const resumedJobIds: string[] = [];
			for (const row of resumable) {
				queue.enqueue(row.jobId, row.input);
				resumedJobIds.push(row.jobId);
			}
			// Counted before the work runs: the guard has to bound restarts, not successes.
			await deps.markResumed(resumedJobIds);
			return resumedJobIds.length;
		},
	};
};

export const finalizationJobService = createFinalizationJobService();
