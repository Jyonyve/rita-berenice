import assert from 'node:assert/strict';
import test from 'node:test';
import { PgDialect } from 'drizzle-orm/pg-core';
import { METADATA_TYPES } from '@rita-berenice/shared/config';
import {
  LoreInfo,
  SESSION_LORE_CONTENT_MAX_LENGTH,
  SESSION_LORE_TITLE_MAX_LENGTH,
  sessionLoreTextSchema,
} from '@rita-berenice/shared/domain';
import { createBasicLore } from '@rita-berenice/shared/util';
import { loreCharacterLinks, lores } from '../db/schema.js';
import { loreToDocument } from '../util/documentUtils.js';
import {
  buildLoreCandidateWhere,
  hydrateLoreRow,
  loreCandidateIdProjection,
  shouldEnqueueLoreEmbedding,
} from './loreStore.js';

const createLore = (
  loreId: string,
  userId: string,
  category: 'World' | 'Item',
  characterIds: string[],
  keywordList: string[] = [],
  sessionId?: string,
  retrievalEnabled = true,
): LoreInfo =>
  ({
    loreId,
    userId,
    sessionId,
    retrievalEnabled,
    type: category === 'World' ? METADATA_TYPES.WORLD : METADATA_TYPES.LORE,
    category,
    title: loreId,
    generatedTitle: loreId,
    content: loreId,
    ...(category === 'Item' ? { source: 'fixture' } : {}),
    characterIds,
    keywordList,
    topicList: [],
    entityList: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }) as LoreInfo;

const compileCandidateWhere = (...args: Parameters<typeof buildLoreCandidateWhere>) =>
  new PgDialect().sqlToQuery(buildLoreCandidateWhere(...args));

test('Lore persistence uses relational columns instead of an aggregate data JSONB column', () => {
  assert.equal('data' in lores, false);
  assert.equal(lores.content.name, 'content');
  assert.equal(lores.retrievalEnabled.name, 'retrieval_enabled');
  assert.equal(loreCharacterLinks.characterId.name, 'character_id');
});

test('RAG candidate selection fetches only Lore IDs before vector ranking', () => {
  assert.deepEqual(Object.keys(loreCandidateIdProjection), ['loreId']);
});

test('lore candidates are filtered by creator authority, session ownership, and retrieval state in SQL', () => {
  const query = compileCandidateWhere('viewer', 'character-a', 'session-a', undefined, 'creator');

  assert.match(query.sql, /"lores"\."retrieval_enabled" = \$1/);
  assert.match(query.sql, /"lores"\."user_id" = \$2/);
  assert.match(query.sql, /"lores"\."session_id" is null/);
  assert.match(query.sql, /"lores"\."user_id" = \$3/);
  assert.match(query.sql, /"lores"\."session_id" = \$4/);
  assert.deepEqual(query.params, [true, 'creator', 'viewer', 'session-a']);
});

test('lore keyword and character candidate checks execute inside PostgreSQL', () => {
  const query = compileCandidateWhere(
    'viewer',
    ['character-a', 'character-b'],
    'session-a',
    { keywords: ['Memory-Map'], entities: { characters: ['Character-C'], locations: [], items: [] } },
    'creator',
  );

  assert.match(query.sql, /lore_character_links/);
  assert.match(query.sql, /unnest\(/);
  assert.match(query.sql, /keyword_list/);
  assert.match(query.sql, /topic_list/);
  assert.match(query.sql, /entity_list/);
  assert.equal(query.params.includes('memory-map'), true);
  assert.equal(query.params.includes('character-c'), true);
});

test('session lore is excluded from the SQL scope when no session is requested', () => {
  const query = compileCandidateWhere('viewer', 'character-a', undefined, undefined, 'creator');

  assert.match(query.sql, /"lores"\."session_id" is null/);
  assert.equal(query.params.includes('viewer'), false);
  assert.equal(query.params.includes('creator'), true);
});

test('new lore starts outside retrieval until the user enables it', () => {
  const lore = createBasicLore({
    content: 'memory',
    title: 'memory',
    userId: 'user-a',
    characterIds: ['character-a'],
    sessionId: 'session-a',
  });

  assert.equal(lore.retrievalEnabled, false);
});

test('only explicitly enabled lore is queued for embedding', () => {
  const missingPreference = createLore('missing', 'user-a', 'Item', ['character-a']);
  delete missingPreference.retrievalEnabled;

  assert.equal(shouldEnqueueLoreEmbedding(createLore('enabled', 'user-a', 'Item', ['character-a'])), true);
  assert.equal(
    shouldEnqueueLoreEmbedding(createLore('disabled', 'user-a', 'Item', ['character-a'], [], undefined, false)),
    false,
  );
  assert.equal(shouldEnqueueLoreEmbedding(missingPreference), false);
});

test('normalized Lore rows hydrate authoritative content and character links', () => {
  const lore = hydrateLoreRow(
    {
      loreId: 'lore-a',
      userId: 'creator',
      sessionId: null,
      loreType: METADATA_TYPES.LORE,
      category: 'Item',
      title: 'Moonstone Protocol',
      generatedTitle: '',
      content: 'Authoritative content',
      source: 'creator notes',
      retrievalEnabled: true,
      keywordList: ['moonstone'],
      topicList: [],
      entityList: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    ['character-a'],
  );

  assert.equal(lore.content, 'Authoritative content');
  assert.deepEqual(lore.characterIds, ['character-a']);
});

test('session lore accepts the exact title and content boundaries and rejects overflow', () => {
  const exact = {
    sessionId: 'session-a',
    title: 't'.repeat(SESSION_LORE_TITLE_MAX_LENGTH),
    content: 'c'.repeat(SESSION_LORE_CONTENT_MAX_LENGTH),
  };

  assert.equal(sessionLoreTextSchema.safeParse(exact).success, true);
  assert.equal(sessionLoreTextSchema.safeParse({ ...exact, title: `${exact.title}t` }).success, false);
  assert.equal(sessionLoreTextSchema.safeParse({ ...exact, content: `${exact.content}c` }).success, false);
});

test('character and world lore are not subject to the session text limits', () => {
  const longContent = 'c'.repeat(SESSION_LORE_CONTENT_MAX_LENGTH + 1);
  const characterLore = createLore('character-long', 'user-a', 'Item', ['character-a']);
  const worldLore = createLore('world-long', 'user-a', 'World', []);
  characterLore.content = longContent;
  worldLore.content = longContent;

  assert.equal(characterLore.content.length, SESSION_LORE_CONTENT_MAX_LENGTH + 1);
  assert.equal(worldLore.content.length, SESSION_LORE_CONTENT_MAX_LENGTH + 1);
});

test('lore embedding content uses title, category, and authoritative content', () => {
  const lore = createLore('authoritative-content', 'user-a', 'Item', ['character-a']);
  lore.title = 'Moonstone Protocol';
  lore.content = 'The complete original lore text.';

  assert.equal(loreToDocument(lore), 'Title: Moonstone Protocol\nCategory: Item\n\nThe complete original lore text.');
  assert.doesNotMatch(loreToDocument(lore), /Summary:/);
});
