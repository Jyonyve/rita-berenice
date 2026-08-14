import { createHash } from 'node:crypto';
import { BackgroundJobSnapshot, BackgroundJobQueue } from '../util/backgroundJobQueue.js';
import { createOperationLogger, serializeError } from '../util/jsonlLogger.js';
import { ReplaceMemoryEmbeddingInput, replaceMemoryEmbedding } from './embeddingService.js';

export interface MemoryEmbeddingJobResult {
	sourceType: ReplaceMemoryEmbeddingInput['sourceType'];
	sourceId: string;
}

export type MemoryEmbeddingJobSnapshot = BackgroundJobSnapshot<MemoryEmbeddingJobResult>;

type ReplaceEmbeddingWorker = (input: ReplaceMemoryEmbeddingInput) => Promise<void>;

interface EmbeddingJobServiceOptions {
	retryDelayMs?: number;
}

const buildEmbeddingJobId = (input: ReplaceMemoryEmbeddingInput, generation = 0): string =>
	`${input.sourceType}:${input.sourceId}:${generation}:${createHash('sha256').update(input.content).digest('hex')}`;

export const createEmbeddingJobService = (
	worker: ReplaceEmbeddingWorker = replaceMemoryEmbedding,
	options: EmbeddingJobServiceOptions = {}
) => {
	const latestJobIdsBySource = new Map<string, string>();
	const generationsBySource = new Map<string, number>();
	const queue = new BackgroundJobQueue<ReplaceMemoryEmbeddingInput, MemoryEmbeddingJobResult>({
		worker: async (input) => {
			const logger = createOperationLogger('embeddingJobService', 'replaceMemoryEmbedding', {
				jobId: buildEmbeddingJobId(input),
				sourceType: input.sourceType,
				sourceId: input.sourceId,
				userId: input.userId,
				characterId: input.characterId,
				sessionId: input.sessionId,
			});
			logger.info('start');

			try {
				await worker(input);
				const result = { sourceType: input.sourceType, sourceId: input.sourceId };
				logger.complete(result);
				return result;
			} catch (error) {
				logger.error('failed', serializeError(error));
				throw error;
			}
		},
		maxAttempts: 3,
		retryDelayMs: options.retryDelayMs ?? 500,
		maxRetainedJobs: 1_000,
	});

	return {
		enqueue(input: ReplaceMemoryEmbeddingInput): MemoryEmbeddingJobSnapshot {
			const sourceKey = `${input.sourceType}:${input.sourceId}`;
			const jobId = buildEmbeddingJobId(input, generationsBySource.get(sourceKey) ?? 0);
			latestJobIdsBySource.set(sourceKey, jobId);
			return queue.enqueue(jobId, input);
		},

		invalidate(input: Pick<ReplaceMemoryEmbeddingInput, 'sourceType' | 'sourceId'>): void {
			const sourceKey = `${input.sourceType}:${input.sourceId}`;
			generationsBySource.set(sourceKey, (generationsBySource.get(sourceKey) ?? 0) + 1);
			latestJobIdsBySource.delete(sourceKey);
		},

		get(input: Pick<ReplaceMemoryEmbeddingInput, 'sourceType' | 'sourceId'>) {
			const jobId = latestJobIdsBySource.get(`${input.sourceType}:${input.sourceId}`);
			return jobId ? queue.get(jobId) : undefined;
		},
	};
};

export const embeddingJobService = createEmbeddingJobService();
