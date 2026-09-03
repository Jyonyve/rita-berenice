import assert from 'node:assert/strict';
import test from 'node:test';
import { runRetriableQueue } from './retriableQueue.js';

test('retriable queue bounds concurrency and retries transient failures', async () => {
  let active = 0;
  let maximumActive = 0;
  const attempts = new Map<number, number>();
  const progress: number[] = [];

  const result = await runRetriableQueue(
    [1, 2, 3, 4],
    async (item) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      const attempt = (attempts.get(item) ?? 0) + 1;
      attempts.set(item, attempt);
      await new Promise<void>((resolve) => setTimeout(resolve, 2));
      active -= 1;
      if (item === 2 && attempt === 1) throw new Error('transient');
    },
    { concurrency: 2, maxAttempts: 3, retryDelayMs: 0, onProgress: (done) => progress.push(done) },
  );

  assert.equal(maximumActive, 2);
  assert.equal(attempts.get(2), 2);
  assert.deepEqual(result.succeeded, [1, 2, 3, 4]);
  assert.deepEqual(result.failed, []);
  assert.deepEqual(
    progress.sort((left, right) => left - right),
    [1, 2, 3, 4],
  );
});

test('retriable queue reports terminal failures without dropping later items', async () => {
  const visited: number[] = [];
  const result = await runRetriableQueue(
    [1, 2, 3],
    async (item) => {
      visited.push(item);
      if (item === 2) throw new Error('permanent');
    },
    { concurrency: 1, maxAttempts: 2, retryDelayMs: 0 },
  );

  assert.deepEqual(result.succeeded, [1, 3]);
  assert.equal(result.failed.length, 1);
  assert.equal(result.failed[0].item, 2);
  assert.deepEqual(visited, [1, 2, 2, 3]);
});
