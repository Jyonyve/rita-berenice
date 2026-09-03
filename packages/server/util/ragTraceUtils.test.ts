import assert from 'node:assert/strict';
import test from 'node:test';
import { flowLogger } from './jsonlLogger.js';
import { isRagTraceEnabled, traceRagEvent } from './ragTraceUtils.js';

const context = {
  traceId: 'trace-1',
  sessionId: 'session-1',
  userId: 'user-1',
  characterId: 'character-1',
  turnId: 'turn-1',
};

test('RAG tracing requires both development mode and the explicit flag', () => {
  assert.equal(isRagTraceEnabled({ NODE_ENV: 'development', RITA_RAG_TRACE: 'true' }), true);
  assert.equal(isRagTraceEnabled({ NODE_ENV: 'development', RITA_RAG_TRACE: 'false' }), false);
  assert.equal(isRagTraceEnabled({ NODE_ENV: 'production', RITA_RAG_TRACE: 'true' }), false);
  assert.equal(isRagTraceEnabled({ NODE_ENV: 'test', RITA_RAG_TRACE: 'true' }), false);
});

test('RAG trace emits context and strips retrieved document content', () => {
  const originalDebug = flowLogger.debug;
  const entries: Array<{ module: string; event: string; data?: Record<string, unknown> }> = [];
  flowLogger.debug = ((module, event, data) => {
    entries.push({ module, event, data });
  }) as typeof flowLogger.debug;

  try {
    traceRagEvent(
      context,
      'search.results',
      {
        queryText: 'where is the map',
        results: [{ sourceId: 'lore-1', distance: 0.2, content: 'private memory text' }],
        documents: ['private document'],
      },
      { NODE_ENV: 'development', RITA_RAG_TRACE: 'true' },
    );

    assert.equal(entries.length, 1);
    assert.equal(entries[0].module, 'ragTrace');
    assert.equal(entries[0].event, 'search.results');
    assert.equal(entries[0].data?.traceId, 'trace-1');
    assert.equal(entries[0].data?.queryText, 'where is the map');
    assert.deepEqual(entries[0].data?.results, [{ sourceId: 'lore-1', distance: 0.2 }]);
    assert.equal('documents' in (entries[0].data ?? {}), false);
  } finally {
    flowLogger.debug = originalDebug;
  }
});

test('RAG trace emits nothing when disabled', () => {
  const originalDebug = flowLogger.debug;
  let callCount = 0;
  flowLogger.debug = (() => {
    callCount += 1;
  }) as typeof flowLogger.debug;

  try {
    traceRagEvent(context, 'disabled', {}, { NODE_ENV: 'development', RITA_RAG_TRACE: 'false' });
    assert.equal(callCount, 0);
  } finally {
    flowLogger.debug = originalDebug;
  }
});
