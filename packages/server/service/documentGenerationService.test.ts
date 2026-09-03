import assert from 'node:assert/strict';
import test from 'node:test';
import type { MemoryResponse } from '@rita-berenice/shared/api';
import { documentDraftRewriteSchema, generatedDocumentDraftCreateSchema } from '@rita-berenice/shared/domain';
import {
  buildDocumentSourceRefs,
  generatedDocumentSchema,
  resolveDocumentGroundingMode,
} from './documentGenerationService.js';

const memories: MemoryResponse = {
  langCode: 'kor',
  shortTermHistory: [],
  longTermHistory: [],
  relevantLore: [],
  relevantHistory: [],
};

test('document grounding is invented when the server selected no sources', () => {
  const refs = buildDocumentSourceRefs(memories);
  assert.equal(resolveDocumentGroundingMode(refs, false), 'invented');
});

test('document grounding distinguishes constrained and mixed artifacts', () => {
  const refs = { ...buildDocumentSourceRefs(memories), chatTurnIds: ['turn-1'] };
  assert.equal(resolveDocumentGroundingMode(refs, false), 'grounded');
  assert.equal(resolveDocumentGroundingMode(refs, true), 'mixed');
});

test('document generation schema requires nullable metadata for strict structured output', () => {
  const parsed = generatedDocumentSchema.parse({
    title: 'SCP object document',
    body: 'Document body',
    documentKind: null,
    issuer: null,
    viewpoint: null,
    claimMode: 'rumor',
    eventKey: 'observatory-incident-2',
    timelineOrder: 42,
    inWorldTime: null,
    includesInventedDetails: true,
  });

  assert.equal(parsed.documentKind, null);
  assert.equal(parsed.claimMode, 'rumor');
  assert.throws(() =>
    generatedDocumentSchema.parse({
      title: 'SCP object document',
      body: 'Document body',
      includesInventedDetails: true,
    }),
  );
});

test('document generation request requires the RAG intent before generation', () => {
  assert.equal(
    generatedDocumentDraftCreateSchema.parse({
      sessionId: 'session-1',
      requestText: 'Create a report.',
      modelName: 'model-1',
      retrievalEnabled: true,
    }).retrievalEnabled,
    true,
  );
  assert.throws(() =>
    generatedDocumentDraftCreateSchema.parse({
      sessionId: 'session-1',
      requestText: 'Create a report.',
      modelName: 'model-1',
    }),
  );
});

test('document rewrite request requires edit instruction, model, and expected revision', () => {
  const parsed = documentDraftRewriteSchema.parse({
    editInstruction: 'Make it sound like an SCP containment note.',
    modelName: 'model-1',
    expectedRevision: 3,
    retrievalEnabled: false,
    sessionId: 'forged-session',
  });

  assert.deepEqual(parsed, {
    editInstruction: 'Make it sound like an SCP containment note.',
    modelName: 'model-1',
    expectedRevision: 3,
  });
  assert.throws(() => documentDraftRewriteSchema.parse({ editInstruction: 'Make it shorter.', modelName: 'model-1' }));
});
