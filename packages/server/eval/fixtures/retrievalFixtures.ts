import { RagEvaluationCase } from '../ragEvaluation.js';

const EVALUATION_NOW = Date.parse('2026-01-08T00:00:00.000Z');
const CURRENT = '2026-01-08T00:00:00.000Z';
const SEVEN_DAYS_OLD = '2026-01-01T00:00:00.000Z';

export const retrievalFixtures: RagEvaluationCase[] = [
  {
    name: 'chat multi-query deduplication',
    query: 'What promise did I make at the ruined gate?',
    k: 2,
    relevantIds: ['turn-oath', 'turn-gate'],
    queryResults: [
      {
        ids: ['turn-oath', 'turn-noise', 'turn-gate'],
        documents: ['The user swore an oath.', 'They discussed dinner.', 'They met at the gate.'],
        metadatas: [{ updatedAt: CURRENT }, { updatedAt: CURRENT }, { updatedAt: CURRENT }],
        distances: [0.05, 0.4, 0.15],
      },
      {
        ids: ['turn-oath', 'turn-weather'],
        documents: ['The user swore an oath.', 'Rain was expected.'],
        metadatas: [{ updatedAt: CURRENT }, { updatedAt: CURRENT }],
        distances: [0.08, 0.5],
      },
    ],
    rankingOptions: {
      semanticWeight: 0.7,
      recencyWeight: 0.3,
      updatedAtField: 'updatedAt',
      nowMs: EVALUATION_NOW,
    },
    minimums: { precisionAtK: 1, recallAtK: 1, hitRateAtK: 1, reciprocalRank: 1 },
  },
  {
    name: 'history semantic ranking',
    query: 'Why did the character leave the academy?',
    k: 2,
    relevantIds: ['history-expulsion', 'history-mentor'],
    queryResults: [
      {
        ids: ['history-expulsion', 'history-market', 'history-mentor'],
        documents: [
          'The academy expelled her after the forbidden experiment.',
          'She bought fruit at the market.',
          'Her mentor accepted responsibility for the experiment.',
        ],
        metadatas: [{ updatedAt: SEVEN_DAYS_OLD }, { updatedAt: CURRENT }, { updatedAt: SEVEN_DAYS_OLD }],
        distances: [0.05, 0.5, 0.15],
      },
    ],
    rankingOptions: {
      semanticWeight: 1,
      recencyWeight: 0,
      updatedAtField: 'updatedAt',
      nowMs: EVALUATION_NOW,
    },
    minimums: { precisionAtK: 1, recallAtK: 1, hitRateAtK: 1, reciprocalRank: 1 },
  },
  {
    name: 'lore recency blend',
    query: 'What changed in the northern succession law?',
    k: 2,
    relevantIds: ['lore-new-law'],
    queryResults: [
      {
        ids: ['lore-old-law', 'lore-new-law', 'lore-festival'],
        documents: [
          'The former succession law favored the eldest heir.',
          'The new decree permits a council-selected heir.',
          'The northern festival lasts three nights.',
        ],
        metadatas: [{ updatedAt: SEVEN_DAYS_OLD }, { updatedAt: CURRENT }, { updatedAt: SEVEN_DAYS_OLD }],
        distances: [0.1, 0.2, 0.5],
      },
    ],
    rankingOptions: {
      semanticWeight: 0.5,
      recencyWeight: 0.5,
      updatedAtField: 'updatedAt',
      nowMs: EVALUATION_NOW,
    },
    minimums: { precisionAtK: 0.5, recallAtK: 1, hitRateAtK: 1, reciprocalRank: 1 },
  },
];
