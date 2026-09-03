import { type AiModelInfo, type ChatTurn, type RecapInfo } from '@rita-berenice/shared/domain';
import { buildRecapId, resolveUtilityModelInfo } from '@rita-berenice/shared/util';
import { chatStore } from '../store/chatStore.js';
import { recapStore } from '../store/recapStore.js';
import { BackgroundJobQueue, type BackgroundJobSnapshot } from '../util/backgroundJobQueue.js';
import { createOperationLogger, flowLogger, serializeError } from '../util/jsonlLogger.js';
import {
  FACTUAL_RECAP_WINDOW_SIZE,
  buildCanonicalFactualRecapInfo,
  buildFactualRecapWindow,
  generateCanonicalFactualRecap,
  validateFactualRecapSourceTurns,
  type GeneratedFactualRecap,
} from './factualRecapGenerationService.js';

export interface FactualRecapGenerationJobInput {
  recapId: string;
  turns: ChatTurn[];
}

export interface FactualRecapGenerationJobResult {
  recapId: string;
  created: boolean;
}

export type FactualRecapGenerationJobSnapshot = BackgroundJobSnapshot<FactualRecapGenerationJobResult>;

export interface RecapGenerationJobDeps {
  getTurnsBySequences: (sessionId: string, sequences: number[]) => Promise<ChatTurn[]>;
  hasRecap: (recapId: string, sessionId: string, userId: string) => Promise<boolean>;
  generateRecap: (turns: ChatTurn[], userId: string, modelInfo: AiModelInfo) => Promise<GeneratedFactualRecap>;
  storeRecapIfAbsent: (recap: RecapInfo) => Promise<{ recapId: string; created: boolean }>;
}

export interface RecapGenerationJobServiceOptions {
  modelInfo?: AiModelInfo;
  retryDelayMs?: number;
}

export const databaseRecapGenerationJobDeps: RecapGenerationJobDeps = {
  getTurnsBySequences: async (sessionId, sequences) =>
    (await chatStore.getChatTurnsBySequences(sessionId, sequences)).chatTurns,
  hasRecap: (recapId, sessionId, userId) => recapStore.hasRecap(recapId, sessionId, userId),
  generateRecap: generateCanonicalFactualRecap,
  storeRecapIfAbsent: (recap) => recapStore.storeRecapIfAbsent(recap),
};

export const createRecapGenerationJobService = (
  deps: RecapGenerationJobDeps = databaseRecapGenerationJobDeps,
  options: RecapGenerationJobServiceOptions = {},
) => {
  const queue = new BackgroundJobQueue<FactualRecapGenerationJobInput, FactualRecapGenerationJobResult>({
    worker: async ({ recapId, turns }) => {
      const ordered = validateFactualRecapSourceTurns(turns);
      const firstTurn = ordered[0]!;
      const modelInfo = options.modelInfo ?? resolveUtilityModelInfo(ordered.at(-1)?.response.model);
      const logger = createOperationLogger('recapGenerationJobService', 'generateFactualRecap', {
        jobId: recapId,
        sessionId: firstTurn.sessionId,
        userId: firstTurn.userId,
        characterId: firstTurn.characterId,
        turnStart: firstTurn.sequence,
        turnEnd: ordered.at(-1)!.sequence,
        model: modelInfo.model,
      });
      logger.info('start');

      try {
        if (await deps.hasRecap(recapId, firstTurn.sessionId, firstTurn.userId)) {
          const result = { recapId, created: false };
          logger.complete(result);
          return result;
        }
        const generated = await deps.generateRecap(ordered, firstTurn.userId, modelInfo);
        // A second server process may have finished the same deterministic window while this
        // model call was running. The insert below is also conflict-safe, but this check avoids
        // replacing reviewed data and makes the expected race explicit.
        if (await deps.hasRecap(recapId, firstTurn.sessionId, firstTurn.userId)) {
          const result = { recapId, created: false };
          logger.complete(result);
          return result;
        }
        const recap = buildCanonicalFactualRecapInfo(ordered, generated, modelInfo.model);
        const result = await deps.storeRecapIfAbsent(recap);
        logger.complete(result);
        return result;
      } catch (error) {
        logger.error('failed', serializeError(error));
        throw error;
      }
    },
    maxAttempts: 3,
    retryDelayMs: options.retryDelayMs ?? 500,
    maxRetainedJobs: 1_000,
  });

  return {
    async enqueueForFinalizedTurn(turn: ChatTurn): Promise<FactualRecapGenerationJobSnapshot | undefined> {
      const currentWindow = buildFactualRecapWindow(turn.sequence);
      // The first turn of a new window gets one chance to recover the immediately preceding
      // window. This covers a process restart after its fourth turn without repeatedly retrying
      // an old provider failure on every later message.
      const candidateWindows = [
        ...(turn.sequence === currentWindow.turnStart && currentWindow.turnStart >= FACTUAL_RECAP_WINDOW_SIZE
          ? [
              {
                turnStart: currentWindow.turnStart - FACTUAL_RECAP_WINDOW_SIZE,
                turnEnd: currentWindow.turnStart - 1,
              },
            ]
          : []),
        currentWindow,
      ];
      let scheduled: FactualRecapGenerationJobSnapshot | undefined;

      for (const { turnStart, turnEnd } of candidateWindows) {
        const sequences = Array.from({ length: FACTUAL_RECAP_WINDOW_SIZE }, (_, index) => turnStart + index);
        const turns = await deps.getTurnsBySequences(turn.sessionId, sequences);
        if (turns.length !== FACTUAL_RECAP_WINDOW_SIZE) continue;

        const ordered = validateFactualRecapSourceTurns(turns);
        const firstTurn = ordered[0]!;
        if (firstTurn.userId !== turn.userId || firstTurn.sessionId !== turn.sessionId) {
          throw new Error('Recap source window does not belong to the finalized turn owner.');
        }
        const recapId = buildRecapId(turn.sessionId, turnStart, turnEnd);
        if (await deps.hasRecap(recapId, turn.sessionId, firstTurn.userId)) {
          const existing = queue.get(recapId);
          scheduled =
            existing && existing.status !== 'failed'
              ? existing
              : queue.recordCompleted(recapId, { recapId, turns: ordered }, { recapId, created: false });
          continue;
        }
        scheduled = queue.enqueue(recapId, { recapId, turns: ordered });
      }
      return scheduled;
    },

    get(recapId: string): FactualRecapGenerationJobSnapshot | undefined {
      return queue.get(recapId);
    },
  };
};

export const recapGenerationJobService = createRecapGenerationJobService();

export const enqueueRecapGenerationAfterFinalization = async (turn: ChatTurn): Promise<void> => {
  try {
    await recapGenerationJobService.enqueueForFinalizedTurn(turn);
  } catch (error) {
    // Recap scheduling is ancillary to durable chat finalization. A failed eligibility read must
    // be visible, but must never turn a successfully stored user message into a failed chat job.
    flowLogger.error('recapGenerationJobService', 'enqueue.failed', {
      sessionId: turn.sessionId,
      turn: turn.sequence,
      recapWindow: buildFactualRecapWindow(turn.sequence),
      ...serializeError(error),
    });
  }
};
