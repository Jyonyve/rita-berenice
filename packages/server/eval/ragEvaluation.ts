import { ChromaResponse } from '@rita-berenice/shared/api';
import { reRankSemanticResults } from '../util/queryUtils.js';

export interface RetrievalMetrics {
	precisionAtK: number;
	recallAtK: number;
	hitRateAtK: number;
	reciprocalRank: number;
	duplicateRateAtK: number;
}

export interface RagEvaluationCase {
	name: string;
	query: string;
	k: number;
	relevantIds: string[];
	queryResults: ChromaResponse[];
	rankingOptions: {
		semanticWeight: number;
		recencyWeight: number;
		updatedAtField: string;
		nowMs: number;
	};
	minimums: Pick<RetrievalMetrics, 'precisionAtK' | 'recallAtK' | 'hitRateAtK' | 'reciprocalRank'>;
}

export interface RagEvaluationResult {
	name: string;
	query: string;
	retrievedIds: string[];
	metrics: RetrievalMetrics;
	minimums: RagEvaluationCase['minimums'];
}

export const calculateRetrievalMetrics = (
	retrievedIds: string[],
	relevantIds: string[],
	k: number
): RetrievalMetrics => {
	const topK = retrievedIds.slice(0, k);
	const relevantIdSet = new Set(relevantIds);
	const uniqueRelevantHits = new Set(topK.filter((id) => relevantIdSet.has(id)));
	const firstRelevantRank = topK.findIndex((id) => relevantIdSet.has(id));
	const uniqueRetrievedCount = new Set(topK).size;

	return {
		precisionAtK: k > 0 ? uniqueRelevantHits.size / k : 0,
		recallAtK: relevantIdSet.size > 0 ? uniqueRelevantHits.size / relevantIdSet.size : 0,
		hitRateAtK: uniqueRelevantHits.size > 0 ? 1 : 0,
		reciprocalRank: firstRelevantRank >= 0 ? 1 / (firstRelevantRank + 1) : 0,
		duplicateRateAtK: topK.length > 0 ? 1 - uniqueRetrievedCount / topK.length : 0,
	};
};

export const runRagEvaluation = (evaluationCase: RagEvaluationCase): RagEvaluationResult => {
	const ranked = reRankSemanticResults(
		evaluationCase.queryResults,
		evaluationCase.k,
		evaluationCase.rankingOptions
	);

	return {
		name: evaluationCase.name,
		query: evaluationCase.query,
		retrievedIds: ranked.ids,
		metrics: calculateRetrievalMetrics(ranked.ids, evaluationCase.relevantIds, evaluationCase.k),
		minimums: evaluationCase.minimums,
	};
};
