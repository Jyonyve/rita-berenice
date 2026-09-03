import assert from 'node:assert/strict';
import test from 'node:test';
import { diffDocumentLines, resolveLastDocumentRequest } from './documentDiffUtils.js';
import { filterDocumentsByRagPreference } from './documentPageUtils.js';
import type { DocumentInfo } from '@rita-berenice/shared/domain';

const documentWithRagPreference = (documentId: string, retrievalEnabled: boolean | undefined): DocumentInfo =>
  ({ documentId, retrievalEnabled }) as DocumentInfo;

test('document list filters by the draft or approved RAG preference', () => {
  const documents = [
    documentWithRagPreference('included', true),
    documentWithRagPreference('not-included', false),
    documentWithRagPreference('legacy-not-included', undefined),
  ];

  assert.deepEqual(
    filterDocumentsByRagPreference(documents, 'all').map((document) => document.documentId),
    ['included', 'not-included', 'legacy-not-included'],
  );
  assert.deepEqual(
    filterDocumentsByRagPreference(documents, 'included').map((document) => document.documentId),
    ['included'],
  );
  assert.deepEqual(
    filterDocumentsByRagPreference(documents, 'notIncluded').map((document) => document.documentId),
    ['not-included', 'legacy-not-included'],
  );
});

test('last document request is absent when no document or comparison is selected', () => {
  assert.equal(resolveLastDocumentRequest(undefined, undefined, undefined), undefined);
});

test('last document request prefers the active rewrite comparison instruction', () => {
  assert.equal(
    resolveLastDocumentRequest('document-1', 'Generated request', {
      documentId: 'document-1',
      instruction: 'Rewrite request',
    }),
    'Rewrite request',
  );
});

test('document diff marks unchanged, removed, and added lines with line numbers', () => {
  const diff = diffDocumentLines('Title\nOld line\nSame', 'Title\nNew line\nSame');

  assert.deepEqual(diff, [
    { kind: 'unchanged', text: 'Title', oldLineNumber: 1, newLineNumber: 1 },
    { kind: 'removed', text: 'Old line', oldLineNumber: 2 },
    { kind: 'added', text: 'New line', newLineNumber: 2 },
    { kind: 'unchanged', text: 'Same', oldLineNumber: 3, newLineNumber: 3 },
  ]);
});

test('document diff handles inserted and deleted lines', () => {
  const diff = diffDocumentLines('A\nB\nC', 'A\nC\nD');

  assert.deepEqual(
    diff.map(({ kind, text }) => ({ kind, text })),
    [
      { kind: 'unchanged', text: 'A' },
      { kind: 'removed', text: 'B' },
      { kind: 'unchanged', text: 'C' },
      { kind: 'added', text: 'D' },
    ],
  );
});

test('document diff bounds work for very long rewrites while preserving common edges', () => {
  const before = ['Same start', ...Array.from({ length: 300 }, (_, index) => `Old ${index}`), 'Same end'];
  const after = ['Same start', ...Array.from({ length: 300 }, (_, index) => `New ${index}`), 'Same end'];
  const diff = diffDocumentLines(before.join('\n'), after.join('\n'));

  assert.equal(diff[0].kind, 'unchanged');
  assert.equal(diff.at(-1)?.kind, 'unchanged');
  assert.equal(diff.filter((line) => line.kind === 'removed').length, 300);
  assert.equal(diff.filter((line) => line.kind === 'added').length, 300);
});
