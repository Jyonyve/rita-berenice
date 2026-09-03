import assert from 'node:assert/strict';
import test from 'node:test';
import { METADATA_TYPES } from '@rita-berenice/shared/config';
import { type ChatTurn, type ChatTurnCdo, type RecapInfo } from '@rita-berenice/shared/domain';
import { buildRecapId, createBasicChatTurn } from '@rita-berenice/shared/util';
import {
  buildCanonicalFactualRecapInfo,
  buildFactualRecapWindow,
  type GeneratedFactualRecap,
} from './factualRecapGenerationService.js';
import {
  createRecapGenerationJobService,
  type FactualRecapGenerationJobSnapshot,
  type RecapGenerationJobDeps,
} from './recapGenerationJobService.js';

const SESSION_ID = 'seoha_demo_session';
const USER_ID = 'user-a';
const CHARACTER_ID = 'seoha_demo';
const PROFILE_ID = `${SESSION_ID}_${USER_ID}`;

const buildTurn = (sequence: number): ChatTurn => {
  const createdAt = `2026-09-02T00:00:0${sequence}.000Z`;
  const buildMessage = (role: 'user' | 'assistant', text: string) => ({
    sessionId: SESSION_ID,
    sequence,
    messageType: (role === 'user' ? 'request' : 'response') as 'request' | 'response',
    role,
    showName: role === 'user' ? 'User' : 'Character',
    messageId: `${SESSION_ID}_${sequence}_${role}`,
    createdAt,
    updatedAt: createdAt,
    emotion: 'neutral',
    type: METADATA_TYPES.MESSAGE,
    model: 'gpt-5.6-luna',
    entries: [{ type: 'dialogue' as const, prompt: text }],
  });
  return createBasicChatTurn({
    sessionId: SESSION_ID,
    userId: USER_ID,
    characterId: CHARACTER_ID,
    profileId: PROFILE_ID,
    sequence,
    request: buildMessage('user', `request ${sequence}`),
    response: buildMessage('assistant', `response ${sequence}`),
  } as unknown as ChatTurnCdo);
};

const turns = [0, 1, 2, 3].map(buildTurn);
const generated: GeneratedFactualRecap = {
  entries: [{ turnStart: 0, turnEnd: 3, fact: '사용자와 캐릭터가 네 턴 동안 계획을 확인했다.' }],
  confirmedState: '두 사람은 계획을 실행하기로 합의했다.',
  flags: ['plan_confirmed'],
};

const waitForTerminalJob = async (
  service: ReturnType<typeof createRecapGenerationJobService>,
  recapId: string,
): Promise<FactualRecapGenerationJobSnapshot> => {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const job = service.get(recapId);
    if (job?.status === 'completed' || job?.status === 'failed') return job;
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  throw new Error('Recap generation job did not reach a terminal status.');
};

const createHarness = (options: { existing?: boolean; generateFailures?: number } = {}) => {
  let exists = options.existing ?? false;
  let generateCalls = 0;
  const stored: RecapInfo[] = [];
  const deps: RecapGenerationJobDeps = {
    getTurnsBySequences: async (_sessionId, sequences) => turns.filter((turn) => sequences.includes(turn.sequence)),
    hasRecap: async () => exists,
    generateRecap: async () => {
      generateCalls += 1;
      if (generateCalls <= (options.generateFailures ?? 0)) throw new Error('temporary provider failure');
      return generated;
    },
    storeRecapIfAbsent: async (recap) => {
      if (exists) return { recapId: recap.recapId, created: false };
      exists = true;
      stored.push(recap);
      return { recapId: recap.recapId, created: true };
    },
  };
  return {
    deps,
    stored,
    getGenerateCalls: () => generateCalls,
  };
};

test('factual recap windows are fixed to complete groups of four', () => {
  assert.deepEqual(buildFactualRecapWindow(0), { turnStart: 0, turnEnd: 3 });
  assert.deepEqual(buildFactualRecapWindow(3), { turnStart: 0, turnEnd: 3 });
  assert.deepEqual(buildFactualRecapWindow(4), { turnStart: 4, turnEnd: 7 });

  const recap = buildCanonicalFactualRecapInfo(turns, generated, 'gpt-5.6-luna', '2026-09-02T00:00:10.000Z');
  assert.equal(recap.recapId, `${SESSION_ID}_0_3_recap`);
  assert.equal(recap.turnStart, 0);
  assert.equal(recap.turnEnd, 3);
  assert.doesNotMatch(recap.content, /Turn\s+\d|턴\s*\d/u);
});

test('an incomplete window does not enqueue or create a partial recap', async () => {
  const harness = createHarness();
  harness.deps.getTurnsBySequences = async (_sessionId, sequences) =>
    turns.slice(0, 3).filter((turn) => sequences.includes(turn.sequence));
  const service = createRecapGenerationJobService(harness.deps, { retryDelayMs: 1 });

  const job = await service.enqueueForFinalizedTurn(turns[2]!);

  assert.equal(job, undefined);
  assert.equal(harness.getGenerateCalls(), 0);
  assert.equal(harness.stored.length, 0);
});

test('a complete window is generated once and stored with its deterministic recap ID', async () => {
  const harness = createHarness();
  const service = createRecapGenerationJobService(harness.deps, { retryDelayMs: 1 });
  const recapId = buildRecapId(SESSION_ID, 0, 3);

  await Promise.all([
    service.enqueueForFinalizedTurn(turns[3]!),
    service.enqueueForFinalizedTurn(turns[3]!),
    service.enqueueForFinalizedTurn(turns[3]!),
  ]);
  const job = await waitForTerminalJob(service, recapId);

  assert.equal(job.status, 'completed');
  assert.equal(job.result?.created, true);
  assert.equal(harness.getGenerateCalls(), 1);
  assert.deepEqual(
    harness.stored.map((recap) => recap.recapId),
    [recapId],
  );

  const existingJob = await service.enqueueForFinalizedTurn(turns[3]!);
  assert.equal(existingJob?.status, 'completed');
  assert.equal(harness.getGenerateCalls(), 1);
});

test('a transient generation failure retries without creating duplicate recaps', async () => {
  const harness = createHarness({ generateFailures: 2 });
  const service = createRecapGenerationJobService(harness.deps, { retryDelayMs: 1 });
  const recapId = buildRecapId(SESSION_ID, 0, 3);

  await service.enqueueForFinalizedTurn(turns[3]!);
  const job = await waitForTerminalJob(service, recapId);

  assert.equal(job.status, 'completed');
  assert.equal(harness.getGenerateCalls(), 3);
  assert.deepEqual(
    harness.stored.map((recap) => recap.recapId),
    [recapId],
  );
});

test('an already stored recap completes without another model call', async () => {
  const harness = createHarness({ existing: true });
  const service = createRecapGenerationJobService(harness.deps, { retryDelayMs: 1 });

  const job = await service.enqueueForFinalizedTurn(turns[3]!);

  assert.equal(job?.status, 'completed');
  assert.equal(job?.result?.created, false);
  assert.equal(harness.getGenerateCalls(), 0);
  assert.equal(harness.stored.length, 0);
});

test('the first turn of the next window recovers one missing completed window', async () => {
  const harness = createHarness();
  const service = createRecapGenerationJobService(harness.deps, { retryDelayMs: 1 });
  const recapId = buildRecapId(SESSION_ID, 0, 3);

  const job = await service.enqueueForFinalizedTurn(buildTurn(4));
  assert.equal(job?.jobId, recapId);
  const completed = await waitForTerminalJob(service, recapId);

  assert.equal(completed.status, 'completed');
  assert.equal(harness.getGenerateCalls(), 1);
  assert.deepEqual(
    harness.stored.map((recap) => recap.recapId),
    [recapId],
  );
});
