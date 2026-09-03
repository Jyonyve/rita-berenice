import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChatTurnCdo } from '@rita-berenice/shared/domain';
import {
  createBasicChatTurn,
  isDeletionOnlyEdit,
  isResponseEditAllowed,
  isResponseEditChangeAllowed,
} from '@rita-berenice/shared/util';
import { REQUEST_CHARACTER_LIMIT } from '@rita-berenice/shared/config';
import {
  ChatTurnCdoSchema,
  ContinueTempResponseBodySchema,
  createGlossaryExtractionSchema,
  createPersonaResponseSchema,
  ReceiveBotResponseBodySchema,
} from './schemaUtils.js';

const sessionId = 'sample_character_1sYD76a4';

test('glossary extraction schema accepts canonical Korean and English mappings', () => {
  const result = createGlossaryExtractionSchema().parse({
    terms: [
      { koreanTerm: '신호 장막', englishTerm: 'Signal Veil' },
      { koreanTerm: '북부 관측소', englishTerm: 'North Observatory' },
    ],
  });

  assert.equal(result.terms.length, 2);
  assert.equal(result.terms[0]?.englishTerm, 'Signal Veil');
});

test('glossary extraction schema rejects empty term mappings', () => {
  assert.throws(() =>
    createGlossaryExtractionSchema().parse({ terms: [{ koreanTerm: '', englishTerm: 'Signal Veil' }] }),
  );
});

const buildMessage = (messageType: 'request' | 'response') => ({
  role: messageType === 'request' ? ('user' as const) : ('assistant' as const),
  type: 'message',
  model: messageType === 'request' ? '' : 'gpt-5.6-luna',
  emotion: 'neutral',
  entries: [{ type: 'dialogue' as const, prompt: 'Hello' }],
  sequence: 9,
  showName: messageType === 'request' ? 'User' : 'Sample Character',
  createdAt: '',
  messageId: '',
  sessionId,
  updatedAt: '',
  messageType,
});

test('ChatTurnCdoSchema accepts lifecycle placeholders from temporary turns', () => {
  const result = ChatTurnCdoSchema.safeParse({
    userId: 'user-1',
    sessionId,
    sequence: 9,
    request: buildMessage('request'),
    response: buildMessage('response'),
  });

  assert.equal(result.success, true);
  if (!result.success) return;

  const turn = createBasicChatTurn(result.data as ChatTurnCdo);
  assert.equal(turn.request.messageId, `${sessionId}_9_request`);
  assert.equal(turn.response.messageId, `${sessionId}_9_response`);
  assert.notEqual(turn.request.createdAt, '');
  assert.notEqual(turn.request.updatedAt, '');
  assert.notEqual(turn.response.createdAt, '');
  assert.notEqual(turn.response.updatedAt, '');
});

test('ChatTurnCdoSchema still rejects mismatched nested message identity', () => {
  const result = ChatTurnCdoSchema.safeParse({
    userId: 'user-1',
    sessionId,
    sequence: 9,
    request: { ...buildMessage('request'), sequence: 8 },
    response: buildMessage('response'),
  });

  assert.equal(result.success, false);
});

test('ReceiveBotResponseBodySchema accepts generation requests without a content-mode override', () => {
  const result = ReceiveBotResponseBodySchema.safeParse({
    sessionId,
    sequence: 10,
    entries: [{ type: 'dialogue', prompt: 'Continue.' }],
    modelName: 'gpt-5.6-luna',
  });

  assert.equal(result.success, true);
});

test('ReceiveBotResponseBodySchema rejects a client-supplied legacy scene override', () => {
  const result = ReceiveBotResponseBodySchema.safeParse({
    sessionId,
    sequence: 10,
    entries: [{ type: 'dialogue', prompt: 'Continue.' }],
    modelName: 'gpt-5.6-luna',
    isScene: true,
  });

  assert.equal(result.success, false);
});

test('ReceiveBotResponseBodySchema rejects requests over the shared character limit', () => {
  const result = ReceiveBotResponseBodySchema.safeParse({
    sessionId,
    sequence: 10,
    entries: [{ type: 'dialogue', prompt: 'x'.repeat(REQUEST_CHARACTER_LIMIT + 1) }],
    modelName: 'gpt-5.6-luna',
  });

  assert.equal(result.success, false);
});

test('persona and finalization schemas accept generated responses longer than the edit limit', () => {
  const generatedResponse = 'x'.repeat(6000);
  const personaResult = createPersonaResponseSchema('Sample Character', 'User', 'eng').safeParse({
    groundingDecision: 'not_applicable',
    response: generatedResponse,
    emotion: 'neutral',
  });
  const finalizationResult = ChatTurnCdoSchema.safeParse({
    userId: 'user-1',
    sessionId,
    sequence: 9,
    request: buildMessage('request'),
    response: {
      ...buildMessage('response'),
      entries: [{ type: 'dialogue', prompt: generatedResponse }],
    },
  });

  assert.equal(personaResult.success, true);
  assert.equal(finalizationResult.success, true);
});

test('over-limit responses can be saved after deletion without shrinking to 5000 characters', () => {
  const original = '가'.repeat(6_700);
  const candidate = original.slice(0, -1);

  assert.equal(isResponseEditAllowed(original, candidate), true);
  assert.equal(isResponseEditChangeAllowed(original, candidate), true);
});

test('over-limit responses reject insertion and replacement until they reach the limit', () => {
  const original = '가'.repeat(6_700);

  assert.equal(isResponseEditChangeAllowed(original, `${original}나`), false);
  assert.equal(isResponseEditChangeAllowed(original, `나${original.slice(1)}`), false);
  assert.equal(isDeletionOnlyEdit(original, original.slice(100)), true);
});

test('responses at or below the edit limit allow ordinary edits up to the limit', () => {
  assert.equal(isResponseEditChangeAllowed('가'.repeat(5_000), '나'.repeat(5_000)), true);
  assert.equal(isResponseEditChangeAllowed('가'.repeat(5_000), '나'.repeat(5_001)), false);
  assert.equal(isResponseEditAllowed('가'.repeat(6_700), '완전히 고친 짧은 답변'), true);
});

test('manual continuation accepts only a concrete temporary response identity', () => {
  assert.equal(ContinueTempResponseBodySchema.safeParse({ sessionId, sequence: 9, setNo: 2 }).success, true);
  assert.equal(ContinueTempResponseBodySchema.safeParse({ sessionId, sequence: 9, setNo: -1 }).success, false);
  assert.equal(
    ContinueTempResponseBodySchema.safeParse({ sessionId, sequence: 9, setNo: 2, modelName: 'client-model' }).success,
    false,
  );
});
