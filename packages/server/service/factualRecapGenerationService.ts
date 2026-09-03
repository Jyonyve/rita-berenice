import { z } from 'zod';
import { DEFAULT_RECAP_INTERVAL, METADATA_TYPES } from '@rita-berenice/shared/config';
import {
  DEFAULT_EXTRACTION_MODEL,
  type AiModelInfo,
  type ChatTurn,
  type RecapInfo,
} from '@rita-berenice/shared/domain';
import { buildRecapId, getSafeMaxTokens } from '@rita-berenice/shared/util';
import { parseEntriesToConversation } from '../util/chatParseUtils.js';
import { buildChatCompletion } from '../util/llmUtils.js';
import { StructuredOutputValidationError } from '../util/structuredOutputUtils.js';
import { llmService } from './llmService.js';

export const FACTUAL_RECAP_WINDOW_SIZE = DEFAULT_RECAP_INTERVAL;
export const CANONICAL_FACTUAL_RECAP_FLAG = 'canonical_factual_recap:v1';
export const FIXED_RECAP_WINDOW_FLAG = `fixed_turn_window:${FACTUAL_RECAP_WINDOW_SIZE}`;

const factualRecapEntrySchema = z.object({
  turnStart: z.number().int().nonnegative(),
  turnEnd: z.number().int().nonnegative(),
  fact: z.string().trim().min(1).max(4_000),
});

export const generatedFactualRecapSchema = z.object({
  entries: z.array(factualRecapEntrySchema).min(1).max(20),
  confirmedState: z.string().trim().min(1).max(4_000).nullable(),
  flags: z
    .array(
      z
        .string()
        .trim()
        .regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/u)
        .max(200),
    )
    .max(20),
});

export type GeneratedFactualRecap = z.infer<typeof generatedFactualRecapSchema>;

export const buildFactualRecapWindow = (
  sequence: number,
  windowSize = FACTUAL_RECAP_WINDOW_SIZE,
): { turnStart: number; turnEnd: number } => {
  if (!Number.isSafeInteger(sequence) || sequence < 0) throw new Error('sequence must be a non-negative integer.');
  if (!Number.isSafeInteger(windowSize) || windowSize < 1) throw new Error('windowSize must be a positive integer.');
  const turnStart = Math.floor(sequence / windowSize) * windowSize;
  return { turnStart, turnEnd: turnStart + windowSize - 1 };
};

export const validateFactualRecapSourceTurns = (turns: ChatTurn[]): ChatTurn[] => {
  const ordered = [...turns].sort((left, right) => left.sequence - right.sequence);
  if (ordered.length !== FACTUAL_RECAP_WINDOW_SIZE) {
    throw new Error(`Expected exactly ${FACTUAL_RECAP_WINDOW_SIZE} source turns.`);
  }
  const firstTurn = ordered[0];
  if (!firstTurn) throw new Error('Missing first source turn.');
  for (const [index, turn] of ordered.entries()) {
    if (turn.sequence !== firstTurn.sequence + index) throw new Error('Source turns must be contiguous.');
    if (
      turn.sessionId !== firstTurn.sessionId ||
      turn.userId !== firstTurn.userId ||
      turn.characterId !== firstTurn.characterId ||
      turn.profileId !== firstTurn.profileId
    ) {
      throw new Error('Source turns must belong to one session, user, character, and profile.');
    }
  }
  const expectedWindow = buildFactualRecapWindow(firstTurn.sequence);
  if (firstTurn.sequence !== expectedWindow.turnStart || ordered.at(-1)?.sequence !== expectedWindow.turnEnd) {
    throw new Error(`Source turns must fill the fixed window ${expectedWindow.turnStart}-${expectedWindow.turnEnd}.`);
  }
  return ordered;
};

export const validateGeneratedFactualRecap = (
  generated: GeneratedFactualRecap,
  turns: ChatTurn[],
): GeneratedFactualRecap => {
  const ordered = validateFactualRecapSourceTurns(turns);
  const firstSequence = ordered[0]!.sequence;
  const lastSequence = ordered.at(-1)!.sequence;
  let previousEnd = firstSequence - 1;
  for (const [index, entry] of generated.entries.entries()) {
    if (entry.turnStart < firstSequence || entry.turnEnd > lastSequence || entry.turnEnd < entry.turnStart) {
      throw new Error(
        `Generated recap entry ${index + 1} uses invalid range ${entry.turnStart}-${entry.turnEnd}; expected ${firstSequence}-${lastSequence}.`,
      );
    }
    if (entry.turnStart <= previousEnd) {
      throw new Error(`Generated recap entry ${index + 1} is out of order or overlaps the previous entry.`);
    }
    previousEnd = entry.turnEnd;
  }
  return generated;
};

export const buildCanonicalFactualRecapPrompt = (turns: ChatTurn[]): string => {
  const ordered = validateFactualRecapSourceTurns(turns);
  const formattedTurns = ordered
    .map((turn) =>
      [
        `Turn ${turn.sequence} (${turn.createdAt})`,
        `${turn.request.showName}: ${parseEntriesToConversation(turn.request.entries)}`,
        `${turn.response.showName}: ${parseEntriesToConversation(turn.response.entries)}`,
      ].join('\n'),
    )
    .join('\n---\n');

  return [
    `Create one compact Korean factual ledger for the ${FACTUAL_RECAP_WINDOW_SIZE} roleplay chat turns below.`,
    'Return chronological entries grounded in the supplied turn sequence numbers.',
    'Each entry must identify who did what and preserve concrete events, important dialogue, decisions, promises, discoveries, locations, objects, and state changes.',
    'Use only sequence numbers present below. Keep entries ordered and non-overlapping; combine facts from the same turn into one entry.',
    'Paraphrase concisely. Include a short exact quote only when its wording is materially important.',
    'Prefer simple affirmative Korean clauses with explicit subjects and objects. Avoid stacked negation or wording that makes names, titles, and speakers ambiguous.',
    'Source turns may contain <details> status blocks with repeated dates, clock times, locations, and relationship labels. Treat them as supporting metadata, not a template to copy.',
    'Mention an explicitly established story-world date or time at most once, and only when it is materially useful for later recall. Never begin every entry with a timestamp or repeat five-minute clock changes.',
    'Do not invent motives, facts, chronology, or outcomes.',
    'Compress repeated or low-information exchanges, but do not omit a material event.',
    'Set confirmedState to the concrete durable state established at the end of the supplied turns, or null. Keep it shorter than the entries and do not repeat their full chronology.',
    'Across entries and confirmedState, target roughly 400-800 Korean characters when the source contains enough material.',
    'Return a short list of lowercase English snake_case factual flags. Do not emit turn IDs inside flags.',
    '',
    formattedTurns,
  ].join('\n');
};

export const generateCanonicalFactualRecap = async (
  turns: ChatTurn[],
  userId: string,
  modelInfo: AiModelInfo = DEFAULT_EXTRACTION_MODEL,
): Promise<GeneratedFactualRecap> => {
  const safeModelInfo = {
    ...modelInfo,
    maxTokens: getSafeMaxTokens(modelInfo.model, modelInfo.maxTokens),
  } as AiModelInfo;
  const messages = [
    buildChatCompletion(
      'system',
      'You create source-grounded factual memory recaps for a Korean RAG roleplay chatbot. Return valid structured data only.',
    ),
    buildChatCompletion('user', buildCanonicalFactualRecapPrompt(turns)),
  ];
  try {
    const generated = await llmService.invokeStructuredLlm(
      messages,
      safeModelInfo,
      userId,
      generatedFactualRecapSchema,
    );
    return validateGeneratedFactualRecap(generated, turns);
  } catch (error) {
    if (!(error instanceof StructuredOutputValidationError)) throw error;
    const repaired = await llmService.repairStructuredLlmOutput(error, userId, generatedFactualRecapSchema, {
      requiredSchema:
        '{"entries":[{"turnStart":0,"turnEnd":0,"fact":"Korean source-grounded fact"}],"confirmedState":"Korean durable end state or null","flags":["lowercase_english_flag"]}',
      repairModelInfo: safeModelInfo,
    });
    return validateGeneratedFactualRecap(repaired, turns);
  }
};

export const renderCanonicalFactualRecap = (generated: GeneratedFactualRecap): string => {
  const entries = generated.entries.map((entry) => `- ${entry.fact}`);
  if (generated.confirmedState) entries.push(`- 확정 상태: ${generated.confirmedState}`);
  return entries.join('\n');
};

export const buildCanonicalFactualRecapInfo = (
  turns: ChatTurn[],
  generated: GeneratedFactualRecap,
  model: string,
  generatedAt = new Date().toISOString(),
): RecapInfo => {
  const ordered = validateFactualRecapSourceTurns(turns);
  const validated = validateGeneratedFactualRecap(generated, ordered);
  const firstTurn = ordered[0]!;
  const lastTurn = ordered.at(-1)!;
  return {
    type: METADATA_TYPES.RECAP,
    recapId: buildRecapId(firstTurn.sessionId, firstTurn.sequence, lastTurn.sequence),
    sessionId: firstTurn.sessionId,
    characterId: firstTurn.characterId,
    userId: firstTurn.userId,
    profileId: firstTurn.profileId,
    createdAt: generatedAt,
    updatedAt: generatedAt,
    turnStart: firstTurn.sequence,
    turnEnd: lastTurn.sequence,
    model,
    content: renderCanonicalFactualRecap(validated),
    flagList: [...new Set([...validated.flags, CANONICAL_FACTUAL_RECAP_FLAG, FIXED_RECAP_WINDOW_FLAG])],
    loreReferenceList: [],
    historyReferenceList: [],
  };
};
