import assert from 'node:assert/strict';
import test from 'node:test';
import { BackgroundJobQueue } from './backgroundJobQueue.js';

const waitForTerminalStatus = async <TInput, TResult>(
	queue: BackgroundJobQueue<TInput, TResult>,
	jobId: string
) => {
	for (let count = 0; count < 100; count += 1) {
		const job = queue.get(jobId);
		if (job?.status === 'completed' || job?.status === 'failed') return job;
		await new Promise((resolve) => setTimeout(resolve, 1));
	}
	throw new Error(`Job ${jobId} did not finish.`);
};

test('BackgroundJobQueue deduplicates queued work by job ID', async () => {
	let executions = 0;
	const queue = new BackgroundJobQueue<string, string>({
		worker: async (input) => {
			executions += 1;
			return input.toUpperCase();
		},
		retryDelayMs: 1,
	});

	queue.enqueue('same-job', 'first');
	queue.enqueue('same-job', 'second');
	const completed = await waitForTerminalStatus(queue, 'same-job');

	assert.equal(executions, 1);
	assert.equal(completed.result, 'FIRST');
});

test('BackgroundJobQueue retries failures with a bounded attempt count', async () => {
	let executions = 0;
	const queue = new BackgroundJobQueue<void, string>({
		worker: async () => {
			executions += 1;
			if (executions < 3) throw new Error('temporary failure');
			return 'done';
		},
		maxAttempts: 3,
		retryDelayMs: 1,
	});

	queue.enqueue('retry-job', undefined);
	const completed = await waitForTerminalStatus(queue, 'retry-job');

	assert.equal(completed.status, 'completed');
	assert.equal(completed.attempts, 3);
	assert.equal(completed.result, 'done');
});

test('BackgroundJobQueue exposes terminal failure without throwing in the worker loop', async () => {
	const queue = new BackgroundJobQueue<void, string>({
		worker: async () => {
			throw new Error('permanent failure');
		},
		maxAttempts: 2,
		retryDelayMs: 1,
	});

	queue.enqueue('failed-job', undefined);
	const failed = await waitForTerminalStatus(queue, 'failed-job');

	assert.equal(failed.status, 'failed');
	assert.equal(failed.attempts, 2);
	assert.equal(failed.error, 'permanent failure');
});
