export interface RetriableQueueFailure<T> {
  item: T;
  error: unknown;
}

export interface RetriableQueueResult<T> {
  succeeded: T[];
  failed: Array<RetriableQueueFailure<T>>;
}

export interface RetriableQueueOptions {
  concurrency?: number;
  maxAttempts?: number;
  retryDelayMs?: number;
  onProgress?: (completed: number, total: number) => void;
}

const wait = async (durationMs: number): Promise<void> => {
  if (durationMs <= 0) return;
  await new Promise<void>((resolve) => setTimeout(resolve, durationMs));
};

/** Runs idempotent work with a small concurrency cap and bounded retries. */
export const runRetriableQueue = async <T>(
  items: readonly T[],
  worker: (item: T) => Promise<void>,
  options: RetriableQueueOptions = {},
): Promise<RetriableQueueResult<T>> => {
  const concurrency = Math.max(1, Math.floor(options.concurrency ?? 2));
  const maxAttempts = Math.max(1, Math.floor(options.maxAttempts ?? 3));
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? 500);
  const results: Array<{ succeeded: boolean; error?: unknown } | undefined> = new Array(items.length);
  let nextIndex = 0;
  let completed = 0;

  const runWorker = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      let lastError: unknown;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          await worker(items[index]);
          results[index] = { succeeded: true };
          break;
        } catch (error) {
          lastError = error;
          if (attempt < maxAttempts) await wait(retryDelayMs * attempt);
        }
      }

      results[index] ??= { succeeded: false, error: lastError };
      completed += 1;
      options.onProgress?.(completed, items.length);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()));

  return {
    succeeded: items.filter((_, index) => results[index]?.succeeded),
    failed: items.flatMap((item, index) => (results[index]?.succeeded ? [] : [{ item, error: results[index]?.error }])),
  };
};
