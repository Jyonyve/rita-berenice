import assert from 'node:assert/strict';
import test from 'node:test';
import { retrievalFixtures } from './fixtures/retrievalFixtures.js';
import { runRagEvaluation } from './ragEvaluation.js';

for (const fixture of retrievalFixtures) {
	test(`RAG evaluation: ${fixture.name}`, () => {
		const result = runRagEvaluation(fixture);

		console.log(
			JSON.stringify({ case: result.name, retrievedIds: result.retrievedIds, ...result.metrics })
		);

		assert.equal(result.metrics.duplicateRateAtK, 0);
		assert.ok(result.metrics.precisionAtK >= result.minimums.precisionAtK);
		assert.ok(result.metrics.recallAtK >= result.minimums.recallAtK);
		assert.ok(result.metrics.hitRateAtK >= result.minimums.hitRateAtK);
		assert.ok(result.metrics.reciprocalRank >= result.minimums.reciprocalRank);
	});
}
