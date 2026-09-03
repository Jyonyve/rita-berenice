import assert from 'node:assert/strict';
import test from 'node:test';
import {
  documentDraftUpdateSchema,
  manualDocumentDraftCreateSchema,
  type DocumentInfo,
} from '@rita-berenice/shared/domain';
import { ApiError } from '@rita-berenice/shared/domain';
import {
  applyDocumentApproval,
  applyDocumentArchive,
  applyDocumentDraftRewrite,
  applyDocumentDraftUpdate,
  applyDocumentRetrievalPreference,
  documentToEmbeddingContent,
  hydrateEligibleDocuments,
  type DocumentRetrievalRow,
} from './documentStore.js';

const draft = (overrides: Partial<DocumentInfo> = {}): DocumentInfo => ({
  documentId: 'session-1_abcd_document',
  userId: 'user-1',
  sessionId: 'session-1',
  characterId: 'character-1',
  origin: 'manual',
  status: 'draft',
  retrievalEnabled: false,
  title: '관측소 사건 보고서',
  body: '신호 단절과 관련한 내부 보고 내용.',
  documentKind: '사건 보고서',
  issuer: '북부 관측소',
  viewpoint: '현장 조사팀',
  claimMode: 'report',
  eventKey: 'observatory-incident-2',
  timelineOrder: 42,
  inWorldTime: '두 번째 습격 직후',
  groundingMode: 'invented',
  sourceRefs: { chatTurnIds: [], loreIds: [], historyIds: [], recapIds: [], documentIds: [] },
  revision: 1,
  createdAt: '2026-07-21T00:00:00.000Z',
  updatedAt: '2026-07-21T00:00:00.000Z',
  ...overrides,
});

test('manual draft input cannot set server-owned identity, lifecycle, or provenance', () => {
  const parsed = manualDocumentDraftCreateSchema.parse({
    sessionId: 'session-1',
    title: '보고서',
    body: '내용',
    userId: 'attacker',
    status: 'approved',
    retrievalEnabled: true,
    sourceRefs: { chatTurnIds: ['forged-turn'] },
  });

  assert.deepEqual(parsed, {
    sessionId: 'session-1',
    title: '보고서',
    body: '내용',
    claimMode: 'unknown',
  });
});

test('draft update increments revision and preserves retrieval isolation', () => {
  const input = documentDraftUpdateSchema.parse({ title: '수정된 보고서', expectedRevision: 1 });
  const updated = applyDocumentDraftUpdate(draft(), input, '2026-07-21T01:00:00.000Z');

  assert.equal(updated.title, '수정된 보고서');
  assert.equal(updated.revision, 2);
  assert.equal(updated.status, 'draft');
  assert.equal(updated.retrievalEnabled, false);
});

test('approved documents cannot be edited as drafts', () => {
  assert.throws(
    () =>
      applyDocumentDraftUpdate(
        draft({ status: 'approved', retrievalEnabled: true }),
        { body: '변조', expectedRevision: 1 },
        '2026-07-21T01:00:00.000Z',
      ),
    (error) => error instanceof ApiError && error.status === 409,
  );
});

test('stale draft revisions are rejected', () => {
  assert.throws(
    () =>
      applyDocumentDraftUpdate(
        draft({ revision: 2 }),
        { body: '오래된 수정', expectedRevision: 1 },
        '2026-07-21T01:00:00.000Z',
      ),
    (error) => error instanceof ApiError && error.status === 409,
  );
});

test('embedding text labels the document as viewpoint-bound material', () => {
  const content = documentToEmbeddingContent(draft({ groundingMode: 'mixed' }));

  assert.match(content, /In-world document/);
  assert.match(content, /Issuer: 북부 관측소/);
  assert.match(content, /Viewpoint: 현장 조사팀/);
  assert.match(content, /Claim mode: report/);
  assert.match(content, /Event identity: observatory-incident-2/);
  assert.match(content, /In-world timeline order: 42/);
  assert.match(content, /In-world time: 두 번째 습격 직후/);
  assert.match(content, /Grounding: mixed/);
  assert.match(content, /신호 단절/);
});

test('draft metadata keeps repeated in-world events distinct and can clear timeline order', () => {
  const updated = applyDocumentDraftUpdate(
    draft(),
    {
      claimMode: 'opinion',
      eventKey: 'observatory-incident-1',
      timelineOrder: null,
      inWorldTime: '첫 번째 습격 다음 날',
      expectedRevision: 1,
    },
    '2026-07-21T01:00:00.000Z',
  );

  assert.equal(updated.claimMode, 'opinion');
  assert.equal(updated.eventKey, 'observatory-incident-1');
  assert.equal(updated.timelineOrder, undefined);
  assert.equal(updated.inWorldTime, '첫 번째 습격 다음 날');
});

test('draft stores the requested retrieval preference without changing its draft status', () => {
  const updated = applyDocumentDraftUpdate(
    draft(),
    { retrievalEnabled: true, expectedRevision: 1 },
    '2026-07-21T01:00:00.000Z',
  );

  assert.equal(updated.retrievalEnabled, true);
  assert.equal(updated.status, 'draft');
});

test('AI draft rewrite preserves draft isolation and existing RAG preference', () => {
  const updated = applyDocumentDraftRewrite(
    draft({ retrievalEnabled: true }),
    {
      editInstruction: 'Rewrite as an observatory internal report.',
      modelName: 'model-1',
      expectedRevision: 1,
    },
    {
      title: '관측소 내부 보고서',
      body: '개정된 보고 내용.',
      documentKind: '내부 보고서',
      issuer: '북부 관측소',
      viewpoint: '기록 담당자',
      claimMode: 'report',
      groundingMode: 'grounded',
      requestText: 'Rewrite as an observatory internal report.',
      sourceRefs: {
        chatTurnIds: ['turn-1'],
        loreIds: [],
        historyIds: [],
        recapIds: [],
        documentIds: [],
      },
      modelName: 'model-1',
      promptVersion: 'in-world-document-rewrite-v1',
    },
    '2026-07-21T01:00:00.000Z',
  );

  assert.equal(updated.origin, 'generated');
  assert.equal(updated.status, 'draft');
  assert.equal(updated.retrievalEnabled, true);
  assert.equal(updated.revision, 2);
  assert.equal(updated.sourceRefs.chatTurnIds[0], 'turn-1');
});

test('approval and retrieval transitions are deterministic and idempotent', () => {
  const approved = applyDocumentApproval(draft({ retrievalEnabled: true }), '2026-07-21T01:00:00.000Z');
  assert.equal(approved.status, 'approved');
  assert.equal(approved.retrievalEnabled, true);
  assert.equal(approved.revision, 2);

  const alreadyEnabled = applyDocumentRetrievalPreference(approved, true, '2026-07-21T02:00:00.000Z');
  assert.strictEqual(alreadyEnabled, approved);

  const disabled = applyDocumentRetrievalPreference(approved, false, '2026-07-21T02:00:00.000Z');
  assert.equal(disabled.retrievalEnabled, false);
  assert.equal(disabled.revision, 3);

  const reenabled = applyDocumentRetrievalPreference(disabled, true, '2026-07-21T03:00:00.000Z');
  assert.equal(reenabled.retrievalEnabled, true);
  assert.equal(reenabled.revision, 4);

  const archived = applyDocumentArchive(reenabled, '2026-07-21T04:00:00.000Z');
  assert.equal(archived.status, 'archived');
  assert.equal(archived.retrievalEnabled, false);
  assert.strictEqual(applyDocumentArchive(archived, archived.updatedAt), archived);
});

test('manual, generated, and rewritten drafts receive identical approval eligibility', () => {
  for (const document of [
    draft({ origin: 'manual' }),
    draft({ origin: 'generated' }),
    applyDocumentDraftRewrite(
      draft({ origin: 'manual' }),
      { editInstruction: 'Rewrite.', modelName: 'model-1', expectedRevision: 1 },
      {
        title: 'Rewritten',
        body: 'Rewritten body',
        claimMode: 'unknown',
        groundingMode: 'invented',
        requestText: 'Rewrite.',
        sourceRefs: { chatTurnIds: [], loreIds: [], historyIds: [], recapIds: [], documentIds: [] },
        modelName: 'model-1',
        promptVersion: 'test',
      },
      '2026-07-21T01:00:00.000Z',
    ),
  ]) {
    const approved = applyDocumentApproval({ ...document, retrievalEnabled: true }, '2026-07-21T02:00:00.000Z');
    assert.equal(approved.status, 'approved');
    assert.equal(approved.retrievalEnabled, true);
  }
});

test('approved content cannot be directly edited or rewritten with a stale embedding in place', () => {
  const approved = applyDocumentApproval(draft({ retrievalEnabled: true }), '2026-07-21T01:00:00.000Z');
  assert.throws(
    () =>
      applyDocumentDraftUpdate(
        approved,
        { body: 'Stale replacement', expectedRevision: approved.revision },
        '2026-07-21T02:00:00.000Z',
      ),
    (error) => error instanceof ApiError && error.status === 409,
  );
  assert.throws(
    () =>
      applyDocumentDraftRewrite(
        approved,
        { editInstruction: 'Replace it.', modelName: 'model-1', expectedRevision: approved.revision },
        {
          title: 'Replacement',
          body: 'Replacement',
          claimMode: 'unknown',
          groundingMode: 'invented',
          requestText: 'Replace it.',
          sourceRefs: { chatTurnIds: [], loreIds: [], historyIds: [], recapIds: [], documentIds: [] },
          modelName: 'model-1',
          promptVersion: 'test',
        },
        '2026-07-21T02:00:00.000Z',
      ),
    (error) => error instanceof ApiError && error.status === 409,
  );
});

const retrievalRow = (overrides: Partial<DocumentRetrievalRow> = {}): DocumentRetrievalRow => ({
  documentId: 'session-1_abcd_document',
  userId: 'user-1',
  sessionId: 'session-1',
  characterId: 'character-1',
  origin: 'manual',
  status: 'approved',
  retrievalEnabled: true,
  data: draft({
    status: 'approved',
    retrievalEnabled: true,
    body: 'Current PostgreSQL document body.',
  }),
  ...overrides,
});

test('current PostgreSQL lifecycle state is authoritative over stale vector matches', () => {
  const scope = { userId: 'user-1', sessionId: 'session-1', characterId: 'character-1' };
  const staleResult = [{ sourceId: 'session-1_abcd_document', content: 'stale vector content' }];

  for (const row of [
    retrievalRow({ status: 'draft', retrievalEnabled: false }),
    retrievalRow({ status: 'draft', retrievalEnabled: true }),
    retrievalRow({ status: 'approved', retrievalEnabled: false }),
    retrievalRow({ status: 'archived', retrievalEnabled: false }),
  ]) {
    assert.deepEqual(hydrateEligibleDocuments([row], staleResult, scope), []);
  }
  assert.deepEqual(hydrateEligibleDocuments([], staleResult, scope), []);

  const [hydrated] = hydrateEligibleDocuments([retrievalRow()], staleResult, scope);
  assert.equal(hydrated.body, 'Current PostgreSQL document body.');
  assert.equal(hydrated.issuer, '북부 관측소');
  assert.equal(hydrated.viewpoint, '현장 조사팀');
});

test('document hydration enforces owner, session, and character isolation', () => {
  const scope = { userId: 'user-1', sessionId: 'session-1', characterId: 'character-1' };
  const result = [{ sourceId: 'session-1_abcd_document' }];
  for (const row of [
    retrievalRow({ userId: 'user-2' }),
    retrievalRow({ sessionId: 'session-2' }),
    retrievalRow({ characterId: 'character-2' }),
  ]) {
    assert.deepEqual(hydrateEligibleDocuments([row], result, scope), []);
  }
});

test('document origin never grants different retrieval privileges', () => {
  const scope = { userId: 'user-1', sessionId: 'session-1', characterId: 'character-1' };
  for (const origin of ['manual', 'generated'] as const) {
    const row = retrievalRow({ origin, data: draft({ origin }) });
    assert.equal(hydrateEligibleDocuments([row], [{ sourceId: row.documentId }], scope).length, 1);
    assert.equal(
      hydrateEligibleDocuments(
        [{ ...row, status: 'draft', retrievalEnabled: false }],
        [{ sourceId: row.documentId }],
        scope,
      ).length,
      0,
    );
  }
});
