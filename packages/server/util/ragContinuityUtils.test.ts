import assert from 'node:assert/strict';
import test from 'node:test';
import { expandWithFollowingItems } from './ragContinuityUtils.js';

interface Item {
  id: string;
  sequence: number;
}

const expand = (anchors: Item[], candidates: Item[], excludedIds: string[] = [], max = 4) =>
  expandWithFollowingItems(anchors, candidates, {
    getId: (item) => item.id,
    getSequence: (item) => item.sequence,
    excludedIds,
    maxContinuations: max,
  });

test('interleaves immediate following items without changing anchor order', () => {
  const result = expand(
    [
      { id: 'turn-10', sequence: 10 },
      { id: 'turn-20', sequence: 20 },
    ],
    [
      { id: 'turn-11', sequence: 11 },
      { id: 'turn-21', sequence: 21 },
    ],
  );

  assert.deepEqual(
    result.items.map((item) => item.id),
    ['turn-10', 'turn-11', 'turn-20', 'turn-21'],
  );
  assert.deepEqual(
    result.continuations.map((item) => item.id),
    ['turn-11', 'turn-21'],
  );
});

test('excludes turns already present in short-term context', () => {
  const result = expand([{ id: 'turn-10', sequence: 10 }], [{ id: 'turn-11', sequence: 11 }], ['turn-11']);

  assert.deepEqual(
    result.items.map((item) => item.id),
    ['turn-10'],
  );
  assert.deepEqual(result.continuations, []);
});

test('does not duplicate a following turn that is already an anchor', () => {
  const anchors = [
    { id: 'turn-10', sequence: 10 },
    { id: 'turn-11', sequence: 11 },
  ];
  const result = expand(anchors, anchors);

  assert.deepEqual(
    result.items.map((item) => item.id),
    ['turn-10', 'turn-11'],
  );
  assert.deepEqual(result.continuations, []);
});

test('honors the continuation limit', () => {
  const result = expand(
    [
      { id: 'turn-10', sequence: 10 },
      { id: 'turn-20', sequence: 20 },
    ],
    [
      { id: 'turn-11', sequence: 11 },
      { id: 'turn-21', sequence: 21 },
    ],
    [],
    1,
  );

  assert.deepEqual(
    result.items.map((item) => item.id),
    ['turn-10', 'turn-11', 'turn-20'],
  );
});
