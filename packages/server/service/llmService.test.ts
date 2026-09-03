import assert from 'node:assert/strict';
import test from 'node:test';
import { getAiModelInfo } from '@rita-berenice/shared/util';
import { MODEL_LIMITS_INFO } from '@rita-berenice/shared/config';
import { ApiKeyError, getRequiredApiKeyType, SupportAiModelList, type AiModelInfo } from '@rita-berenice/shared/domain';
import { credentialStore } from '../store/credentialStore.js';
import { buildTokenBudget } from '../util/tokenBudgetUtils.js';
import { z } from 'zod';
import { llmService, OutputLengthLimitError } from './llmService.js';
import { StructuredOutputValidationError } from '../util/structuredOutputUtils.js';
import { flowLogger } from '../util/jsonlLogger.js';

test('buildTokenBudget reserves output tokens inside the context window', () => {
  const aiModelInfo = getAiModelInfo('openai/gpt-5.6-terra');
  const budget = buildTokenBudget(20_000, aiModelInfo);

  assert.deepEqual(budget, {
    inputTokens: 20_000,
    reservedOutputTokens: 8_192,
    contextWindow: 1_050_000,
    availableInputTokens: 1_041_808,
  });
});

test('buildTokenBudget respects a smaller configured output reservation', () => {
  const aiModelInfo = { ...getAiModelInfo('openai/gpt-5.6-terra'), maxTokens: 4_096 };
  const budget = buildTokenBudget(20_000, aiModelInfo);

  assert.equal(budget?.reservedOutputTokens, 4_096);
  assert.equal(budget?.availableInputTokens, 1_045_904);
});

test('buildTokenBudget returns null when model limits are unavailable', () => {
  const aiModelInfo = {
    platform: 'openrouter',
    provider: 'openai',
    model: 'openai/not-configured',
    maxTokens: 1_500,
  } as unknown as AiModelInfo;

  assert.equal(buildTokenBudget(20_000, aiModelInfo), null);
});

test('model defaults omit unsupported temperature parameters', () => {
  assert.equal(getAiModelInfo('openai/gpt-5.6-terra').temperature, undefined);
  assert.equal(getAiModelInfo('anthropic/claude-sonnet-5').temperature, undefined);
  assert.equal(getAiModelInfo('google/gemini-3.5-flash').temperature, 0.85);
});

test('selectable model registry contains current metadata and excludes retired models', () => {
  for (const model of SupportAiModelList) {
    assert.ok(MODEL_LIMITS_INFO[model], `Missing model limits for ${model}`);
  }
  assert.equal(SupportAiModelList.includes('anthropic/claude-3.7-sonnet'), false);
  assert.equal(SupportAiModelList.includes('google/gemini-2.0-flash-001'), false);
});

test('invokeStructuredLlm returns a typed object from validated model output', async () => {
  const originalCreateLlmInstance = llmService.createLlmInstance;
  const originalValidateTokenCount = llmService.validateTokenCount;
  llmService.validateTokenCount = (async () => undefined) as typeof llmService.validateTokenCount;
  llmService.createLlmInstance = (async () => ({
    invoke: async () => ({ content: '{"properNouns":["Signal Veil"]}' }),
  })) as unknown as typeof llmService.createLlmInstance;

  try {
    const result = await llmService.invokeStructuredLlm(
      [],
      getAiModelInfo('openai/gpt-5.6-terra'),
      'test-user',
      z.object({ properNouns: z.array(z.string()) }),
    );

    assert.deepEqual(result, { properNouns: ['Signal Veil'] });
  } finally {
    llmService.createLlmInstance = originalCreateLlmInstance;
    llmService.validateTokenCount = originalValidateTokenCount;
  }
});

test('invokeStructuredLlm uses native structured output for every direct provider', async () => {
  const originalCreateLlmInstance = llmService.createLlmInstance;
  const originalValidateTokenCount = llmService.validateTokenCount;
  const directModels = [
    { platform: 'direct', provider: 'openai', model: 'gpt-5.6-luna' },
    { platform: 'direct', provider: 'anthropic', model: 'claude-sonnet-5' },
    { platform: 'direct', provider: 'google', model: 'gemini-3.5-flash' },
  ] as const;
  let nativeInvocationCount = 0;

  llmService.validateTokenCount = (async () => undefined) as typeof llmService.validateTokenCount;
  llmService.createLlmInstance = (async () => ({
    withStructuredOutput: () => ({
      invoke: async () => {
        nativeInvocationCount += 1;
        return { parsed: { properNouns: ['Signal Veil'] }, raw: { content: '' } };
      },
    }),
    invoke: async () => {
      throw new Error('manual invocation should not run');
    },
  })) as unknown as typeof llmService.createLlmInstance;

  try {
    for (const model of directModels) {
      const result = await llmService.invokeStructuredLlm(
        [],
        { ...model, maxTokens: 2_000 } as AiModelInfo,
        'test-user',
        z.object({ properNouns: z.array(z.string()) }),
      );
      assert.deepEqual(result, { properNouns: ['Signal Veil'] });
    }
    assert.equal(nativeInvocationCount, directModels.length);
  } finally {
    llmService.createLlmInstance = originalCreateLlmInstance;
    llmService.validateTokenCount = originalValidateTokenCount;
  }
});

test('invokeStructuredLlm validates native raw output when provider parsing is unavailable', async () => {
  const originalCreateLlmInstance = llmService.createLlmInstance;
  const originalValidateTokenCount = llmService.validateTokenCount;
  llmService.validateTokenCount = (async () => undefined) as typeof llmService.validateTokenCount;
  llmService.createLlmInstance = (async () => ({
    withStructuredOutput: () => ({
      invoke: async () => ({ parsed: null, raw: { content: '{"properNouns":["Signal Veil"]}' } }),
    }),
  })) as unknown as typeof llmService.createLlmInstance;

  try {
    const result = await llmService.invokeStructuredLlm(
      [],
      { platform: 'direct', provider: 'openai', model: 'gpt-5.6-luna', maxTokens: 2_000 },
      'test-user',
      z.object({ properNouns: z.array(z.string()) }),
    );

    assert.deepEqual(result, { properNouns: ['Signal Veil'] });
  } finally {
    llmService.createLlmInstance = originalCreateLlmInstance;
    llmService.validateTokenCount = originalValidateTokenCount;
  }
});

test('streamStructuredLlm returns a typed object while preserving raw delta callbacks', async () => {
  const originalCreateLlmInstance = llmService.createLlmInstance;
  const originalValidateTokenCount = llmService.validateTokenCount;
  const deltas: string[] = [];
  llmService.validateTokenCount = (async () => undefined) as typeof llmService.validateTokenCount;
  llmService.createLlmInstance = (async () => ({
    stream: async function* () {
      yield { content: '{"response":"Hel' };
      yield { content: 'lo","emotion":"happy"}' };
    },
  })) as unknown as typeof llmService.createLlmInstance;

  try {
    const result = await llmService.streamStructuredLlm(
      [],
      getAiModelInfo('openai/gpt-5.6-terra'),
      'test-user',
      (delta) => deltas.push(delta),
      z.object({ response: z.string(), emotion: z.string() }),
    );

    assert.deepEqual(result, { response: 'Hello', emotion: 'happy' });
    assert.deepEqual(deltas, ['{"response":"Hel', 'lo","emotion":"happy"}']);
  } finally {
    llmService.createLlmInstance = originalCreateLlmInstance;
    llmService.validateTokenCount = originalValidateTokenCount;
  }
});

test('streamStructuredLlm continues a structured response that reaches the model output limit', async () => {
  const originalCreateLlmInstance = llmService.createLlmInstance;
  const originalValidateTokenCount = llmService.validateTokenCount;
  const deltas: string[] = [];
  let streamCount = 0;
  llmService.validateTokenCount = (async () => undefined) as typeof llmService.validateTokenCount;
  llmService.createLlmInstance = (async () => ({
    stream: async function* () {
      streamCount += 1;
      if (streamCount === 1) {
        yield { content: '{"response":"Hello' };
        yield { content: '', response_metadata: { finish_reason: 'length' } };
        return;
      }
      yield { content: ' world","emotion":"happy"}' };
      yield { content: '', response_metadata: { finish_reason: 'stop' } };
    },
  })) as unknown as typeof llmService.createLlmInstance;

  try {
    const result = await llmService.streamStructuredLlm(
      [],
      getAiModelInfo('openai/gpt-5.6-terra'),
      'test-user',
      (delta) => deltas.push(delta),
      z.object({ response: z.string(), emotion: z.string() }),
    );

    assert.deepEqual(result, { response: 'Hello world', emotion: 'happy' });
    assert.equal(streamCount, 2);
    assert.deepEqual(deltas, ['{"response":"Hello', ' world","emotion":"happy"}']);
  } finally {
    llmService.createLlmInstance = originalCreateLlmInstance;
    llmService.validateTokenCount = originalValidateTokenCount;
  }
});

test('streamStructuredLlm preserves partial output after bounded continuation attempts', async () => {
  const originalCreateLlmInstance = llmService.createLlmInstance;
  const originalValidateTokenCount = llmService.validateTokenCount;
  let streamCount = 0;
  llmService.validateTokenCount = (async () => undefined) as typeof llmService.validateTokenCount;
  llmService.createLlmInstance = (async () => ({
    stream: async function* () {
      streamCount += 1;
      yield { content: streamCount === 1 ? '{"response":"kept' : ' and kept' };
      yield { content: '', response_metadata: { finish_reason: 'max_tokens' } };
    },
  })) as unknown as typeof llmService.createLlmInstance;

  try {
    await assert.rejects(
      llmService.streamStructuredLlm(
        [],
        getAiModelInfo('openai/gpt-5.6-terra'),
        'test-user',
        () => undefined,
        z.object({ response: z.string(), emotion: z.string() }),
      ),
      (error: unknown) => {
        assert.ok(error instanceof OutputLengthLimitError);
        assert.equal(error.rawOutput, '{"response":"kept and kept and kept');
        return true;
      },
    );
    assert.equal(streamCount, 3);
  } finally {
    llmService.createLlmInstance = originalCreateLlmInstance;
    llmService.validateTokenCount = originalValidateTokenCount;
  }
});

test('repairStructuredLlmOutput delegates malformed output repair through structured invocation', async () => {
  const originalInvokeStructuredLlm = llmService.invokeStructuredLlm;
  let capturedPrompt = '';
  llmService.invokeStructuredLlm = (async (messages) => {
    capturedPrompt = String(messages[0]?.content ?? '');
    return { response: 'Hello', emotion: 'happy' };
  }) as typeof llmService.invokeStructuredLlm;

  try {
    const result = await llmService.repairStructuredLlmOutput(
      new StructuredOutputValidationError('The model returned malformed JSON.', '{"response":'),
      'test-user',
      z.object({ response: z.string(), emotion: z.string() }),
      { requiredSchema: '{"response": "string", "emotion": "string"}' },
    );

    assert.deepEqual(result, { response: 'Hello', emotion: 'happy' });
    assert.match(capturedPrompt, /PREVIOUS FAILED OUTPUT/);
    assert.match(capturedPrompt, /\{"response":/);
    assert.match(capturedPrompt, /"emotion": "string"/);
  } finally {
    llmService.invokeStructuredLlm = originalInvokeStructuredLlm;
  }
});

test('invokeStructuredLlm logs structured parse failures without raw output content', async () => {
  const originalCreateLlmInstance = llmService.createLlmInstance;
  const originalValidateTokenCount = llmService.validateTokenCount;
  const originalWarn = flowLogger.warn;
  const warnings: Array<{ message: string; data?: Record<string, unknown> }> = [];
  llmService.validateTokenCount = (async () => undefined) as typeof llmService.validateTokenCount;
  llmService.createLlmInstance = (async () => ({
    invoke: async () => ({ content: '{"properNouns":' }),
  })) as unknown as typeof llmService.createLlmInstance;
  flowLogger.warn = ((_module, message, data) => {
    warnings.push({ message, data });
  }) as typeof flowLogger.warn;

  try {
    await assert.rejects(
      () =>
        llmService.invokeStructuredLlm(
          [],
          getAiModelInfo('openai/gpt-5.6-terra'),
          'test-user',
          z.object({ properNouns: z.array(z.string()) }),
        ),
      StructuredOutputValidationError,
    );

    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].message, 'structuredOutput.parseFailed');
    assert.equal(warnings[0].data?.reason, 'The model returned malformed JSON.');
    assert.equal(warnings[0].data?.rawOutputLength, 15);
    assert.equal(Object.hasOwn(warnings[0].data ?? {}, 'rawOutput'), false);
  } finally {
    llmService.createLlmInstance = originalCreateLlmInstance;
    llmService.validateTokenCount = originalValidateTokenCount;
    flowLogger.warn = originalWarn;
  }
});

test('getRequiredApiKeyType maps every supported platform and provider', () => {
  assert.equal(getRequiredApiKeyType('openrouter', 'anthropic'), 'openrouterApiKey');
  assert.equal(getRequiredApiKeyType('direct', 'openai'), 'openaiApiKey');
  assert.equal(getRequiredApiKeyType('direct', 'anthropic'), 'anthropicApiKey');
  assert.equal(getRequiredApiKeyType('direct', 'google'), 'googleApiKey');
  assert.equal(getRequiredApiKeyType('direct', 'unknown'), undefined);
  assert.equal(getRequiredApiKeyType('unknown', 'openai'), undefined);
});

test('createLlmInstance refuses to fall back to the server key when the user has none', async () => {
  const originalGetKeys = credentialStore.getDecryptedUserApiKeys;
  credentialStore.getDecryptedUserApiKeys = (async () => ({})) as typeof originalGetKeys;

  try {
    // direct/openai is the case that used to silently borrow the server's embedding key.
    await assert.rejects(llmService.createLlmInstance(getAiModelInfo('gpt-5.6-terra'), 'user-1'), (error: unknown) => {
      assert.ok(error instanceof ApiKeyError);
      assert.equal(error.reason, 'missing');
      assert.equal(error.keyType, 'openaiApiKey');
      assert.equal(error.status, 400);
      return true;
    });

    await assert.rejects(
      llmService.createLlmInstance(getAiModelInfo('openai/gpt-5.6-terra'), 'user-1'),
      (error: unknown) => {
        assert.ok(error instanceof ApiKeyError);
        assert.equal(error.keyType, 'openrouterApiKey');
        return true;
      },
    );
  } finally {
    credentialStore.getDecryptedUserApiKeys = originalGetKeys;
  }
});

test('invokeLlm reports a provider-refused key as a rejected-key error', async () => {
  const originalCreateLlmInstance = llmService.createLlmInstance;
  const originalValidateTokenCount = llmService.validateTokenCount;
  llmService.validateTokenCount = (async () => undefined) as typeof llmService.validateTokenCount;
  llmService.createLlmInstance = (async () => ({
    invoke: async () => {
      throw Object.assign(new Error('Incorrect API key provided'), { status: 401 });
    },
  })) as unknown as typeof llmService.createLlmInstance;

  const originalErrorLogger = flowLogger.error;
  flowLogger.error = (() => undefined) as typeof flowLogger.error;

  try {
    await assert.rejects(
      llmService.invokeLlm([{ role: 'user', content: 'hi' }], getAiModelInfo('gpt-5.6-terra'), 'user-1'),
      (error: unknown) => {
        assert.ok(error instanceof ApiKeyError);
        assert.equal(error.reason, 'rejected');
        assert.equal(error.keyType, 'openaiApiKey');
        assert.equal(error.status, 401);
        return true;
      },
    );
  } finally {
    llmService.createLlmInstance = originalCreateLlmInstance;
    llmService.validateTokenCount = originalValidateTokenCount;
    flowLogger.error = originalErrorLogger;
  }
});
