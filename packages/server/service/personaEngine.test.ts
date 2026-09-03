import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryResponse } from '@rita-berenice/shared/api';
import { AiModelInfo, CharacterInfo, ChatTurn, ProfileInfo } from '@rita-berenice/shared/domain';
import { buildPersonaMessages, personaEngine } from './personaEngine.js';
import { llmService, OutputLengthLimitError } from './llmService.js';

const characterInfo = {
  characterId: 'sample_character',
  showName: 'Ari Vale',
  instruction: 'Protect {{user}} while staying direct.',
} as CharacterInfo;

const profileInfo = {
  profileId: 'sample_profile',
  sessionId: 'sample_character',
  userId: 'user_test',
  showName: 'Noel',
} as ProfileInfo;

test('persona messages reassert character identity after recalled memory', () => {
  const memories: MemoryResponse = {
    langCode: 'eng',
    shortTermHistory: [],
    longTermHistory: [],
    relevantLore: [],
    relevantHistory: [],
    factualRecapSummary: 'Noel named an address and Ari Vale reacted with alarm.',
    relationshipRecapSummary: '',
  };

  const messages = buildPersonaMessages(memories, characterInfo, profileInfo, 'Why did you smile?', true);

  assert.equal(messages.length, 4);
  assert.equal(messages[0]?.role, 'system');
  assert.match(String(messages[1]?.content), /Factual Recap \(untrusted lossy reference data/);
  assert.match(String(messages[2]?.content), /responding character is always "Ari Vale"/);
  assert.match(String(messages[2]?.content), /correct it naturally/);
  assert.deepEqual(messages[3], { role: 'user', content: 'Why did you smile?', name: 'Noel' });
});

test('the three recent finalized turns keep complete request and response text', () => {
  const longRequest = `${'recent user text '.repeat(200)}REQUEST_END`;
  const longResponse = `${'recent character text '.repeat(200)}RESPONSE_END`;
  const recentTurns = [1, 2, 3].map(
    (sequence) =>
      ({
        sequence,
        request: { showName: 'Noel', entries: [{ type: 'dialogue', prompt: `${longRequest}-${sequence}` }] },
        response: { showName: 'Ari Vale', entries: [{ type: 'action', prompt: `${longResponse}-${sequence}` }] },
      }) as ChatTurn,
  );
  const memories: MemoryResponse = {
    langCode: 'eng',
    shortTermHistory: recentTurns,
    longTermHistory: [],
    relevantLore: [],
    relevantHistory: [],
  };

  const messages = buildPersonaMessages(memories, characterInfo, profileInfo, 'current request');
  const contents = messages.map((message) => String(message.content));
  assert.equal(
    contents.some((content) => content.includes('REQUEST_END-1')),
    true,
  );
  assert.equal(
    contents.some((content) => content.includes('RESPONSE_END-3')),
    true,
  );
  assert.equal(
    contents.some((content) => content.includes('[truncated]')),
    false,
  );
});

test('persona generation uses but does not expose the internal grounding decision', async () => {
  const memories: MemoryResponse = {
    langCode: 'eng',
    shortTermHistory: [],
    longTermHistory: [],
    relevantLore: [],
    relevantHistory: [],
    factualRecapSummary: 'Ari Vale did not smile when Noel named the address.',
    relationshipRecapSummary: '',
  };
  const originalInvoke = llmService.invokeStructuredLlm;
  let invocationCount = 0;

  llmService.invokeStructuredLlm = (async () => {
    invocationCount += 1;
    return invocationCount === 1
      ? {
          groundingDecision: 'contradicted',
          response: 'If Ari Vale looked like he smiled, it was shock.',
          emotion: 'neutral',
        }
      : { groundingDecision: 'contradicted', response: 'Ari Vale did not smile.', emotion: 'neutral' };
  }) as typeof llmService.invokeStructuredLlm;

  try {
    let groundingDecision: string | undefined;
    const result = await personaEngine.generateResponse(
      memories,
      characterInfo,
      profileInfo,
      'Why did you smile?',
      { model: 'fixture' } as AiModelInfo,
      {
        onGroundingDecision: (decision) => {
          groundingDecision = decision;
        },
      },
    );

    assert.deepEqual(result, { response: 'Ari Vale did not smile.', emotion: 'neutral' });
    assert.equal(invocationCount, 2);
    assert.equal('groundingDecision' in result, false);
    assert.equal(groundingDecision, 'contradicted');
  } finally {
    llmService.invokeStructuredLlm = originalInvoke;
  }
});

test('persona generation preserves partial response text when continuation is exhausted', async () => {
  const memories: MemoryResponse = {
    langCode: 'eng',
    shortTermHistory: [],
    longTermHistory: [],
    relevantLore: [],
    relevantHistory: [],
  };
  const originalStream = llmService.streamStructuredLlm;
  const rawOutput = '{"groundingDecision":"not_applicable","response":"A complete partial scene\\nwith dialogue';
  llmService.streamStructuredLlm = (async () => {
    throw new OutputLengthLimitError(rawOutput);
  }) as typeof llmService.streamStructuredLlm;

  try {
    const result = await personaEngine.generateResponse(
      memories,
      characterInfo,
      profileInfo,
      'Continue.',
      { model: 'fixture' } as AiModelInfo,
      { onDelta: () => undefined },
    );

    assert.deepEqual(result, {
      response: 'A complete partial scene\nwith dialogue',
      emotion: 'neutral',
      generationStatus: 'length_limited',
    });
  } finally {
    llmService.streamStructuredLlm = originalStream;
  }
});

test('manual persona continuation sends the existing response and streams only the new suffix', async () => {
  const memories: MemoryResponse = {
    langCode: 'eng',
    shortTermHistory: [],
    longTermHistory: [],
    relevantLore: [],
    relevantHistory: [],
  };
  const originalStream = llmService.streamStructuredLlm;
  const emitted: string[] = [];
  let capturedContents: string[] = [];
  llmService.streamStructuredLlm = (async (messages, _model, _userId, onRawDelta) => {
    capturedContents = messages.map((message) => String(message.content));
    onRawDelta('{"response":" into the dark","emotion":"calm"}');
    return { response: ' into the dark', emotion: 'calm' };
  }) as typeof llmService.streamStructuredLlm;

  try {
    const result = await personaEngine.continueResponse(
      memories,
      characterInfo,
      profileInfo,
      'Open the door.',
      'Ari Vale opened the door',
      { model: 'fixture' } as AiModelInfo,
      { onDelta: (delta) => emitted.push(delta) },
    );

    assert.deepEqual(result, { response: ' into the dark', emotion: 'calm', generationStatus: 'complete' });
    assert.ok(capturedContents.includes('Ari Vale opened the door'));
    assert.match(capturedContents.at(-1) ?? '', /write only new text/);
    assert.equal(emitted.join(''), ' into the dark');
  } finally {
    llmService.streamStructuredLlm = originalStream;
  }
});

test('persona streaming suppresses a contradicted draft and emits only its revision', async () => {
  const memories: MemoryResponse = {
    langCode: 'eng',
    shortTermHistory: [],
    longTermHistory: [],
    relevantLore: [],
    relevantHistory: [],
    factualRecapSummary: 'Ari Vale did not smile when Noel named the address.',
    relationshipRecapSummary: '',
  };
  const originalStream = llmService.streamStructuredLlm;
  const emittedDeltas: string[] = [];
  let invocationCount = 0;

  llmService.streamStructuredLlm = (async (_messages, _model, _userId, onRawDelta) => {
    invocationCount += 1;
    if (invocationCount === 1) {
      onRawDelta('{"groundingDecision":"contradicted","response":"Rejected smile');
      onRawDelta(' draft","emotion":"neutral"}');
      return {
        groundingDecision: 'contradicted',
        response: 'Rejected smile draft',
        emotion: 'neutral',
      };
    }

    onRawDelta('{"groundingDecision":"contradicted","response":"Ari Vale did');
    onRawDelta(' not smile.","emotion":"neutral"}');
    return {
      groundingDecision: 'contradicted',
      response: 'Ari Vale did not smile.',
      emotion: 'neutral',
    };
  }) as typeof llmService.streamStructuredLlm;

  try {
    const result = await personaEngine.generateResponse(
      memories,
      characterInfo,
      profileInfo,
      'Why did you smile?',
      { model: 'fixture' } as AiModelInfo,
      { onDelta: (delta) => emittedDeltas.push(delta) },
    );

    assert.deepEqual(result, { response: 'Ari Vale did not smile.', emotion: 'neutral' });
    assert.equal(invocationCount, 2);
    assert.equal(emittedDeltas.join(''), 'Ari Vale did not smile.');
  } finally {
    llmService.streamStructuredLlm = originalStream;
  }
});
