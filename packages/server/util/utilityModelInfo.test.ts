import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MODEL_LIMITS_INFO,
  SUPPORTED_MODEL_INFO,
  UTILITY_MODEL_INFO,
  UTILITY_MODEL_PREFERENCE,
} from '@rita-berenice/shared/config';
import { DEFAULT_EXTRACTION_MODEL, getRequiredApiKeyType } from '@rita-berenice/shared/domain';
import { resolveUtilityModelInfo, resolveUtilityModelInfoForKeyTypes } from '@rita-berenice/shared/util';

test('every utility model is already a supported model with known limits', () => {
  for (const [platform, providers] of Object.entries(UTILITY_MODEL_INFO)) {
    for (const [provider, model] of Object.entries(providers)) {
      const supported = SUPPORTED_MODEL_INFO[platform]?.[provider];
      assert.ok(
        Array.isArray(supported) && supported.includes(model),
        `${platform}/${provider} points at unsupported model ${model}`,
      );
      assert.ok(MODEL_LIMITS_INFO[model], `${model} has no entry in MODEL_LIMITS_INFO`);
    }
  }
});

test('a direct Google turn keeps its utility calls on the Google key', () => {
  const utility = resolveUtilityModelInfo('gemini-3.7-flash');

  assert.equal(utility.platform, 'direct');
  assert.equal(utility.provider, 'google');
  assert.equal(utility.model, UTILITY_MODEL_INFO.direct.google);
});

test('an OpenRouter turn keeps its utility calls on OpenRouter', () => {
  const utility = resolveUtilityModelInfo('anthropic/claude-sonnet-5');

  assert.equal(utility.platform, 'openrouter');
  assert.equal(utility.provider, 'anthropic');
  assert.equal(utility.model, UTILITY_MODEL_INFO.openrouter.anthropic);
});

test('an unlisted OpenRouter model falls back to itself, never to another provider', () => {
  // OpenRouter's catalog is fetched live, so a turn can run on a model this repo never listed.
  // Falling back to DEFAULT_EXTRACTION_MODEL here would demand an OpenAI key the user lacks -
  // exactly the failure this resolution exists to prevent.
  const utility = resolveUtilityModelInfo('meta-llama/llama-4-scout');

  assert.equal(utility.platform, 'openrouter');
  assert.equal(utility.provider, 'meta-llama');
  assert.equal(utility.model, 'meta-llama/llama-4-scout');
});

test('a direct OpenAI turn resolves to the balanced OpenAI tier', () => {
  const utility = resolveUtilityModelInfo('gpt-5.6-terra');

  assert.equal(utility.platform, 'direct');
  assert.equal(utility.provider, 'openai');
  assert.equal(utility.model, 'gpt-5.6-luna');
});

test('only a missing or unreadable turn model reaches the default extraction model', () => {
  assert.deepEqual(resolveUtilityModelInfo(undefined), DEFAULT_EXTRACTION_MODEL);
  assert.deepEqual(resolveUtilityModelInfo('not-a-real-model'), DEFAULT_EXTRACTION_MODEL);
});

test('utility calls run cooler than chat, and skip temperature where unsupported', () => {
  assert.equal(resolveUtilityModelInfo('gpt-5.6-terra').temperature, undefined);
  // gpt-5.6-* rejects the parameter, so a turn falling back to itself must not send one.
  assert.equal(resolveUtilityModelInfo('openai/gpt-5.6-sol').temperature, undefined);
});

test('the key-based preference order only names supported models', () => {
  for (const { platform, provider } of UTILITY_MODEL_PREFERENCE) {
    assert.ok(UTILITY_MODEL_INFO[platform]?.[provider], `${platform}/${provider} has no utility model`);
    assert.ok(getRequiredApiKeyType(platform, provider), `${platform}/${provider} maps to no API key type`);
  }
});

test('turn-less work runs on a provider the user actually registered', () => {
  // The gap that made this necessary: an account with only a Google key could chat but could not
  // create a character, because glossary extraction was pinned to OpenAI.
  const googleOnly = resolveUtilityModelInfoForKeyTypes(['googleApiKey']);
  assert.equal(googleOnly.platform, 'direct');
  assert.equal(googleOnly.provider, 'google');

  const openrouterOnly = resolveUtilityModelInfoForKeyTypes(['openrouterApiKey']);
  assert.equal(openrouterOnly.platform, 'openrouter');

  const anthropicOnly = resolveUtilityModelInfoForKeyTypes(['anthropicApiKey']);
  assert.equal(anthropicOnly.provider, 'anthropic');
});

test('an OpenAI key still wins, so nothing changes for accounts that already had one', () => {
  const both = resolveUtilityModelInfoForKeyTypes(['googleApiKey', 'openaiApiKey', 'openrouterApiKey']);
  assert.equal(both.platform, 'direct');
  assert.equal(both.provider, 'openai');
  assert.equal(both.model, 'gpt-5.6-luna');
});

test('no registered key leaves the existing missing-key failure in place', () => {
  assert.deepEqual(resolveUtilityModelInfoForKeyTypes([]), DEFAULT_EXTRACTION_MODEL);
});
