import assert from 'node:assert/strict';
import test from 'node:test';
import { getAiModelInfo } from '@rita-berenice/shared/util';
import { buildTokenBudget } from '../util/tokenBudgetUtils.js';

test('buildTokenBudget reserves output tokens inside the context window', () => {
	const aiModelInfo = getAiModelInfo('openai/gpt-4o');
	const budget = buildTokenBudget(20_000, aiModelInfo);

	assert.deepEqual(budget, {
		inputTokens: 20_000,
		reservedOutputTokens: 16_384,
		contextWindow: 128_000,
		availableInputTokens: 111_616,
	});
});

test('buildTokenBudget respects a smaller configured output reservation', () => {
	const aiModelInfo = { ...getAiModelInfo('openai/gpt-4o'), maxTokens: 4_096 };
	const budget = buildTokenBudget(20_000, aiModelInfo);

	assert.equal(budget?.reservedOutputTokens, 4_096);
	assert.equal(budget?.availableInputTokens, 123_904);
});

test('buildTokenBudget returns null when model limits are unavailable', () => {
	const aiModelInfo = getAiModelInfo('deepseek/deepseek-chat-v3-0324:free');

	assert.equal(buildTokenBudget(20_000, aiModelInfo), null);
});
