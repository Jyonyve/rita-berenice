import assert from 'node:assert/strict';
import test from 'node:test';
import { METADATA_TYPES } from '@rita-berenice/shared/config';
import { MemoryResponse } from '@rita-berenice/shared/api';
import {
  AiModelInfo,
  ApiError,
  CharacterInfo,
  ChatTurn,
  ProfileInfo,
  TempChatTurn,
} from '@rita-berenice/shared/domain';
import { parseEntriesToConversation } from '../util/chatParseUtils.js';
import { loadRecentChatTurnsForPrompt, orderRecentChatTurnsForPrompt } from '../store/chatStore.js';
import { getDatabase } from '../db/postgresClient.js';
import {
  continueTempResponse,
  mergeResponseContinuation,
  recallMemoriesPreservingRecentTurns,
  reconcileTempTurnRequest,
} from './orchestrationService.js';

const SESSION_ID = 'seoha_demo_session';

const buildTempTurn = (requestPrompts: string[]): TempChatTurn =>
  ({
    userId: 'user-1',
    tempTurnId: `${SESSION_ID}_6_temp`,
    sessionId: SESSION_ID,
    sequence: 6,
    type: METADATA_TYPES.TEMP,
    createdAt: '2026-08-24T00:00:00.000Z',
    updatedAt: '2026-08-24T00:00:00.000Z',
    setCount: requestPrompts.length,
    fixedSetNo: -1,
    chatTurnSets: requestPrompts.map((prompt, setNo) => ({
      setNo,
      request: { entries: [{ type: 'dialogue', prompt }] },
      response: { entries: [{ type: 'dialogue', prompt: 'answer' }] },
    })),
  }) as unknown as TempChatTurn;

/** The caller compares against the serialized conversation, so the test builds it the same way. */
const asConversation = (prompt: string): string => parseEntriesToConversation([{ type: 'dialogue', prompt }]);

const FIRST_QUESTION = '그 지도는 무엇을 대가로 요구하죠?';
const SECOND_QUESTION = '그 지도가 왜 동쪽 탑에 있었죠? 누가 거기 뒀나요?';

const makeLogger = () => {
  const messages: string[] = [];
  return {
    messages,
    debug: () => {},
    info: () => {},
    warn: (message: string) => messages.push(message),
    error: () => {},
    checkpoint: () => {},
    complete: () => {},
  };
};

test('a first response on an empty temp turn is allowed for either intent', () => {
  assert.doesNotThrow(() => reconcileTempTurnRequest(buildTempTurn([]), 'anything', 'new'));
  assert.doesNotThrow(() => reconcileTempTurnRequest(buildTempTurn([]), 'anything', 'reroll'));
});

test('a reroll reusing the same request is allowed', () => {
  const tempTurn = buildTempTurn([FIRST_QUESTION]);
  assert.doesNotThrow(() => reconcileTempTurnRequest(tempTurn, asConversation(FIRST_QUESTION), 'reroll'));
});

test('surrounding whitespace does not make a reroll look like a new message', () => {
  const tempTurn = buildTempTurn([FIRST_QUESTION]);
  assert.doesNotThrow(() => reconcileTempTurnRequest(tempTurn, `  ${asConversation(FIRST_QUESTION)}\n`, 'reroll'));
});

test('a reroll carrying a different request is refused before any generation is paid for', () => {
  // The shape of the public demo incident: two unrelated questions as candidate sets of one turn,
  // where finalizing keeps whichever set is picked and silently drops the other.
  const tempTurn = buildTempTurn([FIRST_QUESTION]);

  assert.throws(
    () => reconcileTempTurnRequest(tempTurn, asConversation(SECOND_QUESTION), 'reroll'),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 409);
      return true;
    },
  );
});

test('a matching new request reuses the saved turn after a lost stream completion', () => {
  const tempTurn = buildTempTurn([FIRST_QUESTION, FIRST_QUESTION]);

  assert.equal(reconcileTempTurnRequest(tempTurn, asConversation(FIRST_QUESTION), 'new', makeLogger()), 'reuse');
  assert.equal(tempTurn.chatTurnSets.length, 2);
  assert.equal(tempTurn.setCount, 2);
});

test('a new message on an occupied turn resets the turn instead of appending a second request', () => {
  // Appending created the one state this model cannot express: the demo registered the same
  // question twice because the streamed response landed as setNo 3 of a stale turn while
  // finalization fixed the stale set as the turn. A 'new' message arriving on an occupied
  // slot is the next conversation turn; it becomes the turn's only request.
  const tempTurn = buildTempTurn([FIRST_QUESTION, FIRST_QUESTION, FIRST_QUESTION]);
  const logger = makeLogger();

  assert.doesNotThrow(() => reconcileTempTurnRequest(tempTurn, asConversation(SECOND_QUESTION), 'new', logger));
  assert.equal(tempTurn.chatTurnSets.length, 0);
  assert.equal(tempTurn.setCount, 0);
  assert.equal(tempTurn.fixedSetNo, -1);
  assert.deepEqual(logger.messages, ['tempTurn.requestMismatch']);
});

test('manual continuation removes an exact repeated boundary without dropping new text', () => {
  assert.equal(mergeResponseContinuation('The door opened', 'opened into darkness.'), 'The door opened into darkness.');
  assert.equal(
    mergeResponseContinuation('The door opened.', 'Beyond it was dark.'),
    'The door opened.\nBeyond it was dark.',
  );
});

test('manual continuation refuses a completed temporary response before invoking any service', async () => {
  const tempTurn = buildTempTurn([FIRST_QUESTION]);
  tempTurn.chatTurnSets[0].response.generationStatus = 'complete';

  await assert.rejects(
    continueTempResponse(tempTurn, 0, {} as CharacterInfo, {} as ProfileInfo, {} as AiModelInfo, []),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 409);
      return true;
    },
  );
});

test('recent finalized turns are restored to chronological prompt order after the descending DB window', () => {
  const turns = [3, 2, 1].map((sequence) => ({ sequence }) as ChatTurn);
  assert.deepEqual(
    orderRecentChatTurnsForPrompt(turns).map((turn) => turn.sequence),
    [1, 2, 3],
  );
});

test('recent prompt history asks PostgreSQL for only three descending rows', async () => {
  const rows = [4, 3, 2, 1].map((sequence) => ({ data: { sequence } as ChatTurn }));
  let requestedLimit: number | undefined;
  const database = {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: async (limit: number) => {
              requestedLimit = limit;
              return rows.slice(0, limit);
            },
          }),
        }),
      }),
    }),
  } as unknown as ReturnType<typeof getDatabase>;

  const turns = await loadRecentChatTurnsForPrompt('session-a', database);

  assert.equal(requestedLimit, 3);
  assert.deepEqual(
    turns.map((turn) => turn.sequence),
    [2, 3, 4],
  );
});

test('RAG failure preserves the recent finalized turns used by stateless generation', async () => {
  const recentTurns = [1, 2, 3].map((sequence) => ({ sequence }) as ChatTurn);
  const fallback: MemoryResponse = {
    langCode: 'eng',
    shortTermHistory: recentTurns,
    longTermHistory: [],
    relevantLore: [],
    relevantHistory: [],
  };
  let failure: unknown;

  const recalled = await recallMemoriesPreservingRecentTurns(
    fallback,
    async () => {
      throw new Error('vector store unavailable');
    },
    (error) => {
      failure = error;
    },
  );

  assert.equal(recalled, fallback);
  assert.deepEqual(recalled.shortTermHistory, recentTurns);
  assert.match(String(failure), /vector store unavailable/);
});

test('an empty first-turn history is a normal RAG input and still invokes recall', async () => {
  const fallback: MemoryResponse = {
    langCode: 'kor',
    shortTermHistory: [],
    longTermHistory: [],
    relevantLore: [],
    relevantHistory: [],
  };
  let recallCount = 0;

  const recalled = await recallMemoriesPreservingRecentTurns(fallback, async () => {
    recallCount += 1;
    return {
      ...fallback,
      relevantLore: [{ loreId: 'first-turn-lore' } as MemoryResponse['relevantLore'][number]],
    };
  });

  assert.equal(recallCount, 1);
  assert.equal(recalled.shortTermHistory.length, 0);
  assert.equal(recalled.relevantLore[0]?.loreId, 'first-turn-lore');
});
