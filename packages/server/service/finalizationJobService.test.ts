import assert from 'node:assert/strict';
import test from 'node:test';
import { FinalizationJobSnapshot } from '@rita-berenice/shared/api';
import { METADATA_TYPES } from '@rita-berenice/shared/config';
import { ApiKeyError, ChatTurn, ChatTurnCdo } from '@rita-berenice/shared/domain';
import { buildChatTurnId, createBasicChatTurn } from '@rita-berenice/shared/util';
import {
  createFinalizationJobService,
  FinalizationJobDeps,
  ResumableFinalizationJob,
} from './finalizationJobService.js';

const SESSION_ID = 'seoha_demo_session';
const SEQUENCE = 6;
const CHAT_TURN_ID = buildChatTurnId(SESSION_ID, SEQUENCE);

const buildMessage = (role: 'user' | 'assistant', text: string) => ({
  sessionId: SESSION_ID,
  sequence: SEQUENCE,
  messageType: (role === 'user' ? 'request' : 'response') as 'request' | 'response',
  role,
  showName: role === 'user' ? 'Guest' : 'Seoha',
  messageId: `${SESSION_ID}_${SEQUENCE}_${role}`,
  createdAt: '2026-08-24T00:00:00.000Z',
  updatedAt: '2026-08-24T00:00:00.000Z',
  emotion: 'neutral',
  type: METADATA_TYPES.MESSAGE,
  model: 'gemini-3.7-flash',
  entries: [{ type: 'dialogue' as const, prompt: text }],
});

const CHAT_TURN_CDO = {
  userId: 'user-1',
  sessionId: SESSION_ID,
  sequence: SEQUENCE,
  request: buildMessage('user', '그 지도는 무엇을 대가로 요구하죠?'),
  response: buildMessage('assistant', '지도는 이름을 원해.'),
} as unknown as ChatTurnCdo;

const enrichedFrom = (turn: ChatTurn): ChatTurn => ({
  ...turn,
  summary: 'The map demands a name in exchange.',
  memoryChunk: 'Seoha revealed the map trades in names.',
});

interface Harness {
  deps: FinalizationJobDeps;
  storedTurns: ChatTurn[];
  embeddingFlags: Array<boolean | undefined>;
  persisted: FinalizationJobSnapshot[];
  resumedJobIds: string[][];
  recapTurns: ChatTurn[];
}

const createHarness = (options: {
  enrich?: (basicTurn: ChatTurn) => Promise<ChatTurn>;
  storedTurn?: ChatTurn;
  persistedJob?: { job: FinalizationJobSnapshot; input?: ChatTurnCdo };
  resumable?: ResumableFinalizationJob[];
}): Harness => {
  const storedTurns: ChatTurn[] = [];
  const embeddingFlags: Array<boolean | undefined> = [];
  const persisted: FinalizationJobSnapshot[] = [];
  const resumedJobIds: string[][] = [];
  const recapTurns: ChatTurn[] = [];
  const store = new Map<string, ChatTurn>();
  if (options.storedTurn) store.set(options.storedTurn.chatTurnId, options.storedTurn);

  return {
    storedTurns,
    embeddingFlags,
    persisted,
    resumedJobIds,
    recapTurns,
    deps: {
      storeChatTurn: async (turn, storeOptions) => {
        storedTurns.push(turn);
        embeddingFlags.push(storeOptions?.enqueueEmbedding);
        store.set(turn.chatTurnId, turn);
      },
      getStoredTurn: async (chatTurnId) => store.get(chatTurnId),
      enrichChatTurn: options.enrich ?? (async (basicTurn) => enrichedFrom(basicTurn)),
      enqueueRecapForTurn: async (turn) => {
        recapTurns.push(turn);
      },
      persistJob: async (job) => {
        persisted.push(job);
      },
      readPersistedJob: async () => options.persistedJob,
      listResumableJobs: async () => options.resumable ?? [],
      markResumed: async (jobIds) => {
        resumedJobIds.push(jobIds);
      },
    },
  };
};

const waitForTerminalJob = async (
  service: ReturnType<typeof createFinalizationJobService>,
): Promise<FinalizationJobSnapshot> => {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const job = await service.get(SESSION_ID, SEQUENCE);
    if (job?.status === 'completed' || job?.status === 'failed') return job;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('Finalization job did not reach a terminal status.');
};

test('the raw turn is stored before enrichment runs', async () => {
  const order: string[] = [];
  const harness = createHarness({
    enrich: async (basicTurn) => {
      order.push('enrich');
      return enrichedFrom(basicTurn);
    },
  });
  const originalStore = harness.deps.storeChatTurn;
  harness.deps.storeChatTurn = async (turn, options) => {
    order.push('store');
    return originalStore(turn, options);
  };

  const service = createFinalizationJobService(harness.deps);
  await service.enqueue(CHAT_TURN_CDO);
  const job = await waitForTerminalJob(service);

  assert.equal(job.status, 'completed');
  assert.deepEqual(order, ['store', 'enrich', 'store']);
  assert.deepEqual(harness.embeddingFlags, [false, undefined]);
  assert.deepEqual(
    harness.recapTurns.map((turn) => turn.chatTurnId),
    [CHAT_TURN_ID],
  );
});

test('a failing enrichment still leaves the unenriched turn stored', async () => {
  const harness = createHarness({
    enrich: async () => {
      throw new ApiKeyError('missing', 'openaiApiKey', 'OpenAI');
    },
  });

  const service = createFinalizationJobService(harness.deps);
  await service.enqueue(CHAT_TURN_CDO);
  const job = await waitForTerminalJob(service);

  assert.equal(job.status, 'failed');
  // This is the whole point of the ordering change: the message survived a failed enrichment.
  assert.ok(harness.storedTurns.length >= 1);
  assert.equal(harness.storedTurns[0].chatTurnId, CHAT_TURN_ID);
  assert.equal(harness.storedTurns[0].request.entries[0].prompt, CHAT_TURN_CDO.request.entries[0].prompt);
  assert.equal(harness.storedTurns[0].summary, '');
  assert.ok(harness.storedTurns.every((turn) => turn.summary === ''));
  assert.ok(harness.embeddingFlags.every((flag) => flag === false));
  assert.equal(harness.recapTurns.length, 0);
});

test('an API key failure is recorded on the job so the client can name it', async () => {
  const harness = createHarness({
    enrich: async () => {
      throw new ApiKeyError('missing', 'openaiApiKey', 'OpenAI');
    },
  });

  const service = createFinalizationJobService(harness.deps);
  await service.enqueue(CHAT_TURN_CDO);
  const job = await waitForTerminalJob(service);

  assert.equal(job.status, 'failed');
  assert.equal(job.errorCode, 'API_KEY_MISSING');
  assert.equal(job.keyType, 'openaiApiKey');
  assert.ok(harness.persisted.some((snapshot) => snapshot.errorCode === 'API_KEY_MISSING'));
});

test('a stored but unenriched turn is not mistaken for a finished job', async () => {
  const unenriched = createBasicChatTurn(CHAT_TURN_CDO);
  let enrichCalls = 0;
  const harness = createHarness({
    storedTurn: unenriched,
    enrich: async (basicTurn) => {
      enrichCalls += 1;
      return enrichedFrom(basicTurn);
    },
  });

  const service = createFinalizationJobService(harness.deps);
  const { job } = await service.enqueue(CHAT_TURN_CDO);

  assert.notEqual(job.status, 'completed');
  const finished = await waitForTerminalJob(service);
  assert.equal(finished.status, 'completed');
  assert.equal(enrichCalls, 1);
  assert.equal(finished.result?.summary, 'The map demands a name in exchange.');
});

test('a stored enriched turn short-circuits the job as completed', async () => {
  let enrichCalls = 0;
  const harness = createHarness({
    storedTurn: enrichedFrom(createBasicChatTurn(CHAT_TURN_CDO)),
    enrich: async (basicTurn) => {
      enrichCalls += 1;
      return enrichedFrom(basicTurn);
    },
  });

  const service = createFinalizationJobService(harness.deps);
  const { job } = await service.enqueue(CHAT_TURN_CDO);

  assert.equal(job.status, 'completed');
  assert.equal(enrichCalls, 0);
  assert.deepEqual(
    harness.recapTurns.map((turn) => turn.chatTurnId),
    [CHAT_TURN_ID],
  );
});

test('resuming counts every job it picks up so failures cannot retry forever', async () => {
  const harness = createHarness({ resumable: [{ jobId: CHAT_TURN_ID, input: CHAT_TURN_CDO }] });

  const service = createFinalizationJobService(harness.deps);
  const resumedCount = await service.resumePendingJobs();

  assert.equal(resumedCount, 1);
  assert.deepEqual(harness.resumedJobIds, [[CHAT_TURN_ID]]);
  await waitForTerminalJob(service);
});
