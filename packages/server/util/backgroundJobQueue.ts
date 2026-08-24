export type BackgroundJobStatus = 'queued' | 'running' | 'retrying' | 'completed' | 'failed';

export interface BackgroundJobSnapshot<TResult> {
	jobId: string;
	status: BackgroundJobStatus;
	attempts: number;
	maxAttempts: number;
	createdAt: string;
	updatedAt: string;
	result?: TResult;
	error?: string;
	/**
	 * Structured detail about the last failure, produced by `readErrorMeta`. The plain `error`
	 * string is written for humans; this is what a caller can branch on - telling "the user has no
	 * API key for this provider" apart from "the model returned nonsense" needs a code, not a
	 * substring match on a message.
	 */
	errorMeta?: BackgroundJobErrorMeta;
}

export interface BackgroundJobErrorMeta {
	code?: string;
	keyType?: string;
}

interface BackgroundJob<TInput, TResult> extends BackgroundJobSnapshot<TResult> {
	input: TInput;
}

interface BackgroundJobQueueOptions<TInput, TResult> {
	worker: (input: TInput) => Promise<TResult>;
	maxAttempts?: number;
	retryDelayMs?: number;
	maxRetainedJobs?: number;
	onChange?: (snapshot: BackgroundJobSnapshot<TResult>, input: TInput) => Promise<void> | void;
	onChangeError?: (
		error: unknown,
		snapshot: BackgroundJobSnapshot<TResult>,
		input: TInput
	) => Promise<void> | void;
	/** Extracts branchable detail from a worker failure. Returning undefined records nothing. */
	readErrorMeta?: (error: unknown) => BackgroundJobErrorMeta | undefined;
}

export class BackgroundJobQueue<TInput, TResult> {
	private readonly jobs = new Map<string, BackgroundJob<TInput, TResult>>();
	private readonly pendingJobIds: string[] = [];
	private processing = false;
	private readonly maxAttempts: number;
	private readonly retryDelayMs: number;
	private readonly maxRetainedJobs: number;

	constructor(private readonly options: BackgroundJobQueueOptions<TInput, TResult>) {
		this.maxAttempts = options.maxAttempts ?? 3;
		this.retryDelayMs = options.retryDelayMs ?? 500;
		this.maxRetainedJobs = options.maxRetainedJobs ?? 500;
	}

	enqueue(jobId: string, input: TInput): BackgroundJobSnapshot<TResult> {
		const existingJob = this.jobs.get(jobId);
		if (existingJob && existingJob.status !== 'failed') {
			return this.toSnapshot(existingJob);
		}

		const now = new Date().toISOString();
		const job: BackgroundJob<TInput, TResult> = {
			jobId,
			input,
			status: 'queued',
			attempts: 0,
			maxAttempts: this.maxAttempts,
			createdAt: existingJob?.createdAt ?? now,
			updatedAt: now,
		};
		this.jobs.set(jobId, job);
		this.pendingJobIds.push(jobId);
		this.trimRetainedJobs();
		void this.notifyChange(job);
		this.scheduleProcessing();
		return this.toSnapshot(job);
	}

	recordCompleted(jobId: string, input: TInput, result: TResult): BackgroundJobSnapshot<TResult> {
		const now = new Date().toISOString();
		const job: BackgroundJob<TInput, TResult> = {
			jobId,
			input,
			status: 'completed',
			attempts: 0,
			maxAttempts: this.maxAttempts,
			createdAt: now,
			updatedAt: now,
			result,
		};
		this.jobs.set(jobId, job);
		this.trimRetainedJobs();
		void this.notifyChange(job);
		return this.toSnapshot(job);
	}

	get(jobId: string): BackgroundJobSnapshot<TResult> | undefined {
		const job = this.jobs.get(jobId);
		return job ? this.toSnapshot(job) : undefined;
	}

	private scheduleProcessing(): void {
		if (this.processing) return;
		this.processing = true;
		queueMicrotask(() => void this.processPendingJobs());
	}

	private async processPendingJobs(): Promise<void> {
		try {
			while (this.pendingJobIds.length > 0) {
				const jobId = this.pendingJobIds.shift();
				const job = jobId ? this.jobs.get(jobId) : undefined;
				if (!job || job.status === 'completed') continue;
				await this.runJob(job);
			}
		} finally {
			this.processing = false;
			if (this.pendingJobIds.length > 0) this.scheduleProcessing();
		}
	}

	private async runJob(job: BackgroundJob<TInput, TResult>): Promise<void> {
		while (job.attempts < job.maxAttempts) {
			job.status = job.attempts === 0 ? 'running' : 'retrying';
			job.attempts += 1;
			job.updatedAt = new Date().toISOString();
			job.error = undefined;
			job.errorMeta = undefined;
			await this.notifyChange(job);

			try {
				job.result = await this.options.worker(job.input);
				job.status = 'completed';
				job.updatedAt = new Date().toISOString();
				await this.notifyChange(job);
				return;
			} catch (error) {
				job.error = error instanceof Error ? error.message : 'Unknown background job error';
				job.errorMeta = this.options.readErrorMeta?.(error);
				job.updatedAt = new Date().toISOString();
				if (job.attempts < job.maxAttempts) {
					job.status = 'retrying';
					await this.notifyChange(job);
					await new Promise((resolve) =>
						setTimeout(resolve, this.retryDelayMs * 2 ** (job.attempts - 1))
					);
				}
			}
		}
		job.status = 'failed';
		job.updatedAt = new Date().toISOString();
		await this.notifyChange(job);
	}

	private toSnapshot(job: BackgroundJob<TInput, TResult>): BackgroundJobSnapshot<TResult> {
		const { input: _input, ...snapshot } = job;
		return { ...snapshot };
	}

	private trimRetainedJobs(): void {
		if (this.jobs.size <= this.maxRetainedJobs) return;
		const removableJobs = [...this.jobs.values()]
			.filter((job) => job.status === 'completed' || job.status === 'failed')
			.sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt));

		while (this.jobs.size > this.maxRetainedJobs && removableJobs.length > 0) {
			const job = removableJobs.shift();
			if (job) this.jobs.delete(job.jobId);
		}
	}

	private async notifyChange(job: BackgroundJob<TInput, TResult>): Promise<void> {
		const snapshot = this.toSnapshot(job);
		try {
			await this.options.onChange?.(snapshot, job.input);
		} catch (error) {
			await this.options.onChangeError?.(error, snapshot, job.input);
		}
	}
}
