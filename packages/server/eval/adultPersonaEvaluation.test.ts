import assert from 'node:assert/strict';
import test from 'node:test';
import { runAdultPersonaEvaluation } from './adultPersonaEvaluation.js';

for (const langCode of ['eng', 'kor'] as const) {
  test(`adult persona evaluation preserves RAG grounding in ${langCode}`, () => {
    const result = runAdultPersonaEvaluation(langCode);

    assert.equal(result.passed, true);
    assert.equal(result.checks.ragContextParity, true);
    assert.equal(result.checks.normalModeExcludesSceneDirective, true);
    assert.equal(result.checks.adultModeIncludesSceneDirective, true);
    assert.equal(result.checks.personaInstructionPreserved, true);
    assert.equal(result.metrics.groundingContextCoverage, 1);
  });
}
