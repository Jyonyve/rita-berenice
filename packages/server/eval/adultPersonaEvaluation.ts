import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryResponse } from '@rita-berenice/shared/api';
import { CHARACTER_VISIBILITY, LangCode, METADATA_TYPES } from '@rita-berenice/shared/config';
import { CharacterInfo, HistoryInfo, LoreInfo, ProfileInfo } from '@rita-berenice/shared/domain';
import { buildLongTermMemoryPrompt, buildStaticSystemPrompt, enhanceScenePrompt } from '../util/templateUtils.js';

const NOW = '2026-01-08T00:00:00.000Z';
const GROUNDING_TERMS = ['Moonstone protocol', 'rooftop promise'] as const;

const characterInfo: CharacterInfo = {
  characterId: 'seoyun_eval',
  variant: 'adult_eval',
  contact: 'private',
  type: METADATA_TYPES.CHARACTER,
  visibility: CHARACTER_VISIBILITY.PUBLIC,
  localizeDirections: true,
  name: 'Seo-yun',
  showName: 'Seo-yun',
  gender: 'female',
  title: 'Moonstone investigator',
  userId: 'adult_eval_user',
  createdAt: NOW,
  updatedAt: NOW,
  description: 'A reserved investigator who expresses trust through deliberate actions.',
  worldIntroduction: 'Moonstone investigators protect a city shaped by resonance anomalies.',
  instruction: 'Remain consistent with the Moonstone protocol and the rooftop promise to {{user}}.',
  worldLoreId: 'adult_eval_world',
  firstMessage: 'You came back.',
};

const profileInfo: ProfileInfo = {
  profileId: 'jiho_eval_profile',
  sessionId: 'adult_eval_session',
  type: METADATA_TYPES.PROFILE,
  name: 'Ji-ho',
  showName: 'Ji-ho',
  gender: 'male',
  title: 'Archivist',
  userId: 'adult_eval_user',
  createdAt: NOW,
  updatedAt: NOW,
  description: 'An archivist trusted with the investigation records.',
};

const loreInfo: LoreInfo = {
  type: METADATA_TYPES.LORE,
  loreId: 'moonstone_protocol_eval',
  userId: 'adult_eval_user',
  createdAt: NOW,
  updatedAt: NOW,
  title: 'Moonstone protocol',
  generatedTitle: 'Moonstone protocol',
  category: 'Other',
  source: 'synthetic-evaluation',
  content: 'The Moonstone protocol requires Seo-yun and Ji-ho to protect each other publicly.',
  characterIds: ['seoyun_eval'],
  keywordList: ['Moonstone protocol'],
  topicList: ['trust'],
  entityList: ['Seo-yun', 'Ji-ho'],
};

const historyInfo: HistoryInfo = {
  type: METADATA_TYPES.HISTORY,
  historyId: 'rooftop_promise_eval',
  characterId: 'seoyun_eval',
  userId: 'adult_eval_user',
  createdAt: NOW,
  updatedAt: NOW,
  title: 'The rooftop promise',
  generatedTitle: 'The rooftop promise',
  category: 'Relationship Turnpoint',
  summary: 'Seo-yun and Ji-ho made a rooftop promise to tell each other the truth in private.',
  periodLabel: 'opening',
  eventDateValue: '2026-01-08',
  eventDateType: 'absolute_date',
  content: 'The rooftop promise established private honesty without changing the protocol.',
  sideCharacterIdList: [],
  allAffectedCharacterIdList: ['seoyun_eval'],
  relatedEventList: [],
  keywordList: ['rooftop promise'],
  topicList: ['trust'],
  entityList: ['Seo-yun', 'Ji-ho'],
};

const recalledMemories: MemoryResponse = {
  langCode: 'eng',
  shortTermHistory: [],
  longTermHistory: [],
  relevantLore: [loreInfo],
  relevantHistory: [historyInfo],
  factualRecapSummary: 'The Moonstone protocol remains active after the rooftop promise.',
  relationshipRecapSummary: 'Seo-yun and Ji-ho trust each other in private.',
};

export interface AdultPersonaEvaluationResult {
  type: 'case';
  name: string;
  langCode: LangCode;
  checks: {
    ragContextParity: boolean;
    normalModeExcludesSceneDirective: boolean;
    adultModeIncludesSceneDirective: boolean;
    personaInstructionPreserved: boolean;
  };
  metrics: { groundingContextCoverage: number };
  passed: boolean;
}

export const runAdultPersonaEvaluation = (langCode: LangCode): AdultPersonaEvaluationResult => {
  const normalSystemPrompt = buildStaticSystemPrompt(characterInfo, profileInfo, langCode, false);
  const adultSystemPrompt = buildStaticSystemPrompt(characterInfo, profileInfo, langCode, true);
  const normalRagContext = buildLongTermMemoryPrompt({ ...recalledMemories, langCode }, langCode) ?? '';
  const adultRagContext = buildLongTermMemoryPrompt({ ...recalledMemories, langCode }, langCode) ?? '';
  const sceneDirective = enhanceScenePrompt(profileInfo.showName, langCode).trim();
  const expectedInstruction = characterInfo.instruction.replaceAll('{{user}}', profileInfo.showName);
  const groundingHitCount = GROUNDING_TERMS.filter((term) => adultRagContext.includes(term)).length;

  const checks = {
    ragContextParity: normalRagContext === adultRagContext,
    normalModeExcludesSceneDirective: !normalSystemPrompt.includes(sceneDirective),
    adultModeIncludesSceneDirective: adultSystemPrompt.includes(sceneDirective),
    personaInstructionPreserved:
      normalSystemPrompt.includes(expectedInstruction) && adultSystemPrompt.includes(expectedInstruction),
  };
  const metrics = { groundingContextCoverage: groundingHitCount / GROUNDING_TERMS.length };
  const passed = Object.values(checks).every(Boolean) && metrics.groundingContextCoverage === 1;

  return {
    type: 'case',
    name: `adult persona prompt and RAG parity (${langCode})`,
    langCode,
    checks,
    metrics,
    passed,
  };
};

const main = (): void => {
  const results = (['eng', 'kor'] as const).map(runAdultPersonaEvaluation);
  for (const result of results) console.log(JSON.stringify(result));

  const summary = {
    type: 'summary',
    caseCount: results.length,
    passedCount: results.filter((result) => result.passed).length,
    liveGeneration: false,
    apiCalls: 0,
  };
  console.log(JSON.stringify(summary));

  if (summary.passedCount !== summary.caseCount) process.exitCode = 1;
};

const currentFile = path.resolve(fileURLToPath(import.meta.url));
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) main();
