import assert from 'node:assert/strict';
import test from 'node:test';
import { createOperationLogger, flowLogger, serializeError } from './jsonlLogger.js';

test('createOperationLogger emits shared operation context and elapsed time', () => {
  const originalInfo = flowLogger.info;
  const entries: Array<{ module: string; message: string; data?: Record<string, unknown> }> = [];
  flowLogger.info = ((module, message, data) => {
    entries.push({ module, message, data });
  }) as typeof flowLogger.info;

  try {
    const logger = createOperationLogger('testModule', 'testOperation', {
      requestId: 'request-1',
      sessionId: 'session-1',
    });

    logger.checkpoint('stage.one', { selectedCount: 3 });
    logger.complete({ finalCount: 5 });

    assert.equal(entries.length, 2);
    assert.deepEqual(
      entries.map((entry) => [entry.module, entry.message]),
      [
        ['testModule', 'checkpoint'],
        ['testModule', 'complete'],
      ],
    );
    assert.equal(entries[0].data?.operation, 'testOperation');
    assert.equal(entries[0].data?.requestId, 'request-1');
    assert.equal(entries[0].data?.sessionId, 'session-1');
    assert.equal(entries[0].data?.stage, 'stage.one');
    assert.equal(entries[0].data?.selectedCount, 3);
    assert.equal(typeof entries[0].data?.elapsedMs, 'number');
    assert.equal(entries[1].data?.finalCount, 5);
  } finally {
    flowLogger.info = originalInfo;
  }
});

test('serializeError returns stable fields for Error instances and unknown values', () => {
  const error = new Error('boom');
  const serializedError = serializeError(error);
  assert.equal(serializedError.errorName, 'Error');
  assert.equal(serializedError.errorMessage, 'boom');
  assert.equal(typeof serializedError.errorStack, 'string');

  assert.deepEqual(serializeError('plain failure'), { errorMessage: 'plain failure' });
});
