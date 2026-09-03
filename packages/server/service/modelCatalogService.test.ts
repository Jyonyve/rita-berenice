import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOpenRouterCatalogEntries, modelCatalogEntryToAiModelInfo } from './modelCatalogService.js';

const model = (id: string, created: number, parameters = ['structured_outputs', 'max_tokens', 'temperature']) => ({
  id,
  name: id,
  created,
  context_length: 1_000_000,
  supported_parameters: parameters,
  top_provider: { max_completion_tokens: 64_000 },
});

test('catalog selects newest preferred model lanes and excludes incompatible variants', () => {
  const entries = buildOpenRouterCatalogEntries({
    data: [
      model('anthropic/claude-sonnet-5', 50, ['structured_outputs', 'max_tokens']),
      model('anthropic/claude-sonnet-4.6', 46),
      model('anthropic/claude-sonnet-4.5', 45),
      model('anthropic/claude-opus-4.8', 80),
      model('anthropic/claude-haiku-4.5', 48),
      model('google/gemini-3.1-pro-preview', 31),
      model('google/gemini-3.5-flash', 35),
      model('google/gemini-3.1-flash-image-preview', 36),
      model('openai/gpt-5.6-sol', 56, ['structured_outputs', 'max_tokens']),
      model('openai/gpt-5.6-terra', 55, ['structured_outputs', 'max_tokens']),
      model('openai/gpt-5.7-sol', 57, ['max_tokens']),
      model('openai/gpt-5.6-codex', 58),
    ],
  });

  // Opus and Haiku have their own lanes, so the flagship and the cheap tier both survive
  // instead of being dropped for not being a Sonnet. Sonnet still keeps two slots, which is
  // why 4.5 is the only Anthropic entry trimmed here.
  assert.deepEqual(
    entries.map((entry) => entry.id),
    [
      'anthropic/claude-opus-4.8',
      'openai/gpt-5.6-sol',
      'openai/gpt-5.6-terra',
      'anthropic/claude-sonnet-5',
      'anthropic/claude-haiku-4.5',
      'anthropic/claude-sonnet-4.6',
      'google/gemini-3.5-flash',
      'google/gemini-3.1-pro-preview',
    ],
  );
  assert.equal(entries.find((entry) => entry.id === 'anthropic/claude-sonnet-5')?.supportsTemperature, false);
});

test('catalog entries resolve to bounded runtime model configuration', () => {
  const [entry] = buildOpenRouterCatalogEntries({ data: [model('google/gemini-3.5-flash', 35)] });
  assert.ok(entry);

  const aiInfo = modelCatalogEntryToAiModelInfo(entry);
  assert.equal(aiInfo.model, 'google/gemini-3.5-flash');
  assert.equal(aiInfo.maxTokens, 8_192);
  assert.equal(aiInfo.temperature, 0.85);
});
