import assert from 'node:assert/strict';
import test from 'node:test';
import { parseChatEntries, serializeChatEntries } from '@rita-berenice/shared/util';
import { parseConversationToEntries, parseEntriesToConversation } from './chatParseUtils.js';
import { sanitizeLlmResponse } from './llmUtils.js';

test('shared chat codec parses asterisk actions and unwrapped dialogue', () => {
  assert.deepEqual(
    parseChatEntries('Are you awake?\n*She waits by the door.*\nI brought coffee.', 'asterisk-actions'),
    [
      { type: 'dialogue', prompt: 'Are you awake?' },
      { type: 'action', prompt: 'She waits by the door.' },
      { type: 'dialogue', prompt: 'I brought coffee.' },
    ],
  );
});

test('shared chat codec keeps unmatched asterisks as dialogue', () => {
  assert.deepEqual(parseChatEntries('A literal * remains visible.', 'asterisk-actions'), [
    { type: 'dialogue', prompt: 'A literal * remains visible.' },
  ]);
});

test('shared chat codec parses quoted dialogue and unquoted actions', () => {
  assert.deepEqual(parseChatEntries('He looks up.\n\u201cCome inside.\u201d\nThe door closes.', 'quoted-dialogue'), [
    { type: 'action', prompt: 'He looks up.' },
    { type: 'dialogue', prompt: 'Come inside.' },
    { type: 'action', prompt: 'The door closes.' },
  ]);
});

test('shared chat codec round-trips both supported syntaxes', () => {
  const entries = [
    { type: 'action' as const, prompt: 'He opens the window.' },
    { type: 'dialogue' as const, prompt: 'It is raining.' },
  ];

  for (const syntax of ['asterisk-actions', 'quoted-dialogue'] as const) {
    assert.deepEqual(parseChatEntries(serializeChatEntries(entries, syntax), syntax), entries);
  }
});

test('server compatibility wrappers use quoted-dialogue syntax', () => {
  const entries = parseConversationToEntries('He pauses.\n"I remember."');
  assert.deepEqual(entries, [
    { type: 'action', prompt: 'He pauses.' },
    { type: 'dialogue', prompt: 'I remember.' },
  ]);
  assert.equal(parseEntriesToConversation(entries), 'He pauses.\n"I remember."');
});

test('LLM response sanitization delegates classification to the shared codec', () => {
  assert.deepEqual(sanitizeLlmResponse('He pauses.\n\u201cI remember.\u201d'), [
    { type: 'action', prompt: 'He pauses.' },
    { type: 'dialogue', prompt: 'I remember.' },
  ]);
});
