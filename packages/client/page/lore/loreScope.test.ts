import assert from 'node:assert/strict';
import test from 'node:test';
import { LoreInfo, RecapInfo } from '@rita-berenice/shared/domain';
import { filterLoreByScope, sortSessionSummaries, syncEditingLoreRetrievalPreference } from './loreScope.js';

const lore = (loreId: string, sessionId?: string) => ({ loreId, sessionId }) as LoreInfo;

test('character lore scope excludes every session-scoped entry', () => {
  assert.deepEqual(
    filterLoreByScope([lore('character'), lore('session-a', 'a'), lore('session-b', 'b')]).map((item) => item.loreId),
    ['character'],
  );
});

test('session lore scope includes only the exact session', () => {
  assert.deepEqual(
    filterLoreByScope([lore('character'), lore('session-a', 'a'), lore('session-b', 'b')], 'a').map(
      (item) => item.loreId,
    ),
    ['session-a'],
  );
});

test('session summaries are presented in chronological turn order without mutating query results', () => {
  const later = { recapId: 'later', turnStart: 21, turnEnd: 30 } as RecapInfo;
  const earlier = { recapId: 'earlier', turnStart: 1, turnEnd: 10 } as RecapInfo;
  const sameStartLonger = { recapId: 'same-start-longer', turnStart: 1, turnEnd: 20 } as RecapInfo;
  const source = [later, sameStartLonger, earlier];

  assert.deepEqual(
    sortSessionSummaries(source).map((summary) => summary.recapId),
    ['earlier', 'same-start-longer', 'later'],
  );
  assert.deepEqual(
    source.map((summary) => summary.recapId),
    ['later', 'same-start-longer', 'earlier'],
  );
});

test('retrieval toggles synchronize the active editor without replacing its draft fields', () => {
  const editingLore = {
    ...lore('memory-a', 'session-a'),
    retrievalEnabled: false,
    title: '편집 중 제목',
    updatedAt: '2026-08-30T00:00:00.000Z',
  } as LoreInfo;
  const updatedLore = {
    ...editingLore,
    retrievalEnabled: true,
    title: '서버의 기존 제목',
    updatedAt: '2026-08-30T01:00:00.000Z',
  } as LoreInfo;

  const synchronized = syncEditingLoreRetrievalPreference(editingLore, updatedLore);

  assert.equal(synchronized?.retrievalEnabled, true);
  assert.equal(synchronized?.updatedAt, updatedLore.updatedAt);
  assert.equal(synchronized?.title, editingLore.title);
  assert.strictEqual(syncEditingLoreRetrievalPreference(editingLore, lore('memory-b')), editingLore);
});
