import assert from 'node:assert/strict';
import test from 'node:test';
import { PgDialect } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { METADATA_TYPES } from '@rita-berenice/shared/config';
import { historyInfoSchema, historyWriteSchema, recapInfoSchema, recapWriteSchema } from '@rita-berenice/shared/domain';
import { buildMemorySearchCandidateProjection } from '../service/embeddingService.js';
import { resolveTrustedRecallIdentity } from '../service/memoryEngine.js';
import { buildSelectedChatTurnsWhere } from './chatStore.js';
import { buildHistoryScopeWhere, historyCandidateIdProjection } from './historyStore.js';
import { buildRecapScopeWhere, latestRecapOrderBy, recapCandidateIdProjection } from './recapStore.js';

const dialect = new PgDialect();
const compile = (fragment: ReturnType<typeof buildSelectedChatTurnsWhere>) => dialect.sqlToQuery(fragment);

test('semantic candidate ranking selects only source identity and distance', () => {
  const projection = buildMemorySearchCandidateProjection(sql<number>`0`);
  assert.deepEqual(Object.keys(projection), ['sourceType', 'sourceId', 'distance']);
  assert.equal('content' in projection, false);
  assert.equal('metadata' in projection, false);
});

test('first-turn recall identity accepts only server-owned character and profile scope', () => {
  const character = {
    characterId: 'character_variant',
    userId: 'creator-a',
    showName: 'Character',
  } as Parameters<typeof resolveTrustedRecallIdentity>[2];
  const profile = {
    sessionId: 'character_variant_session',
    userId: 'user-a',
    showName: 'User',
  } as Parameters<typeof resolveTrustedRecallIdentity>[3];

  assert.deepEqual(resolveTrustedRecallIdentity(profile.sessionId, profile.userId, character, profile), {
    characterId: 'character_variant',
    characterOwnerUserId: 'creator-a',
    characterName: 'Character',
    userName: 'User',
  });
  assert.throws(
    () => resolveTrustedRecallIdentity(profile.sessionId, profile.userId, character, { ...profile, userId: 'other' }),
    /does not match the server-owned session/,
  );
});

test('chat hydration is constrained to the selected IDs in the owned session', () => {
  const query = compile(buildSelectedChatTurnsWhere('session-a', ['turn-a', 'turn-b'], 'user-a'));
  assert.match(query.sql, /"chat_turns"\."session_id" = \$1/);
  assert.match(query.sql, /"chat_turns"\."user_id" = \$2/);
  assert.match(query.sql, /"chat_turns"\."chat_turn_id" in \(\$3, \$4\)/);
  assert.deepEqual(query.params, ['session-a', 'user-a', 'turn-a', 'turn-b']);
});

test('recap candidates are ID-only and SQL-scoped by owner, session, and recap type', () => {
  assert.deepEqual(Object.keys(recapCandidateIdProjection), ['recapId']);
  const query = dialect.sqlToQuery(buildRecapScopeWhere('session-a', 'user-a', METADATA_TYPES.RECAP, ['recap-a']));
  assert.match(query.sql, /"recaps"\."session_id" = \$1/);
  assert.match(query.sql, /"recaps"\."user_id" = \$2/);
  assert.match(query.sql, /"recaps"\."recap_type" = \$3/);
  assert.match(query.sql, /"recaps"\."recap_id" in \(\$4\)/);
  assert.deepEqual(query.params, ['session-a', 'user-a', 'recap', 'recap-a']);
});

test('relationship recap current state is ordered by latest turn range with deterministic ties', () => {
  const compiled = latestRecapOrderBy.map((order) => dialect.sqlToQuery(order).sql);
  assert.match(compiled[0], /"recaps"\."turn_end" desc/);
  assert.match(compiled[1], /"recaps"\."updated_at" desc/);
  assert.match(compiled[2], /"recaps"\."recap_id" desc/);
});

test('history candidates are ID-only and creator-owned in both candidate and hydration scopes', () => {
  assert.deepEqual(Object.keys(historyCandidateIdProjection), ['historyId']);
  const query = dialect.sqlToQuery(buildHistoryScopeWhere('character-a', 'creator-a', ['history-a']));
  assert.match(query.sql, /"histories"\."character_id" = \$1/);
  assert.match(query.sql, /"histories"\."user_id" = \$2/);
  assert.match(query.sql, /"histories"\."history_id" in \(\$3\)/);
  assert.deepEqual(query.params, ['character-a', 'creator-a', 'history-a']);
});

test('recap runtime validation has one trust contract and no provenance field', () => {
  const parsed = recapInfoSchema.parse({
    type: METADATA_TYPES.RECAP,
    recapId: 'recap-a',
    sessionId: 'session-a',
    characterId: 'character-a',
    userId: 'user-a',
    profileId: 'profile-a',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    turnStart: 1,
    turnEnd: 3,
    model: 'fixture',
    content: 'A lossy recap.',
    flagList: [],
    loreReferenceList: [],
    historyReferenceList: [],
    provenance: 'user-authored',
  });
  assert.equal('provenance' in parsed, false);
  assert.equal(recapInfoSchema.safeParse({ ...parsed, turnStart: 4, turnEnd: 3 }).success, false);
  const browserWrite = { ...parsed } as Partial<typeof parsed>;
  delete browserWrite.userId;
  delete browserWrite.characterId;
  delete browserWrite.profileId;
  assert.equal(recapWriteSchema.safeParse(browserWrite).success, true);
});

test('history runtime validation preserves History.summary', () => {
  const parsed = historyInfoSchema.parse({
    type: METADATA_TYPES.HISTORY,
    historyId: 'history-a',
    characterId: 'character-a',
    userId: 'creator-a',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    title: 'Origin',
    generatedTitle: 'Origin',
    category: 'Origin Story',
    summary: 'Canonical creator-authored summary.',
    periodLabel: 'past',
    eventDateValue: '2020',
    eventDateType: 'estimated_year',
    content: 'Canonical creator-authored history content.',
    sideCharacterIdList: [],
    allAffectedCharacterIdList: ['character-a'],
    relatedEventList: [],
    keywordList: [],
    topicList: [],
    entityList: [],
  });
  assert.equal(parsed.summary, 'Canonical creator-authored summary.');
  const browserWrite = { ...parsed } as Partial<typeof parsed>;
  delete browserWrite.userId;
  assert.equal(historyWriteSchema.safeParse(browserWrite).success, true);
});
