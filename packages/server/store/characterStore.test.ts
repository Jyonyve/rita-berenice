import assert from 'node:assert/strict';
import test from 'node:test';
import { CharacterResponse } from '@rita-berenice/shared/api';
import { CHARACTER_VISIBILITY, METADATA_TYPES } from '@rita-berenice/shared/config';
import { ApiError, CharacterInfo } from '@rita-berenice/shared/domain';
import { assertCharacterVisibleToUser, filterCharacterResponseByViewer } from './characterStore.js';

const makeCharacter = (characterId: string, userId: string, visibility: string): CharacterInfo => ({
  characterId,
  userId,
  variant: 'test',
  contact: '',
  type: METADATA_TYPES.CHARACTER,
  visibility: visibility as CharacterInfo['visibility'],
  localizeDirections: true,
  name: characterId,
  showName: characterId,
  gender: 'nocomment',
  title: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  description: '',
  worldIntroduction: '',
  instruction: '',
  worldLoreId: '',
  firstMessage: '',
});

const makeResponse = (characters: CharacterInfo[]): CharacterResponse => {
  const portraitMap: CharacterResponse['characterPortraits'] = {};
  const avatarMap: CharacterResponse['characterAvatars'] = {};
  for (const character of characters) {
    portraitMap[character.characterId] = { 0: '/portrait' };
    avatarMap[character.characterId] = { 0: '/avatar' };
  }
  return {
    characterInfos: characters,
    characterInfo: characters[0] || null,
    characterPortraits: portraitMap,
    characterAvatars: avatarMap,
  };
};

test('filterCharacterResponseByViewer keeps public characters and hides unowned private ones', () => {
  const publicChar = makeCharacter('pub', 'alice', CHARACTER_VISIBILITY.PUBLIC);
  const privateChar = makeCharacter('priv_bob', 'bob', CHARACTER_VISIBILITY.PRIVATE);
  const ownedPrivate = makeCharacter('priv_alice', 'alice', CHARACTER_VISIBILITY.PRIVATE);
  const response = makeResponse([publicChar, privateChar, ownedPrivate]);

  const filtered = filterCharacterResponseByViewer(response, 'alice');

  assert.deepEqual(
    filtered.characterInfos.map((c) => c.characterId),
    ['pub', 'priv_alice'],
  );
  assert.deepEqual(Object.keys(filtered.characterPortraits), ['pub', 'priv_alice']);
  assert.deepEqual(Object.keys(filtered.characterAvatars), ['pub', 'priv_alice']);
  assert.equal(filtered.characterInfo?.characterId, 'pub');
});

test('filterCharacterResponseByViewer hides every unowned private character', () => {
  const privateChar = makeCharacter('priv_bob', 'bob', CHARACTER_VISIBILITY.PRIVATE);
  const filtered = filterCharacterResponseByViewer(makeResponse([privateChar]), 'alice');

  assert.equal(filtered.characterInfos.length, 0);
  assert.equal(filtered.characterInfo, null);
  assert.deepEqual(filtered.characterPortraits, {});
  assert.deepEqual(filtered.characterAvatars, {});
});

test('assertCharacterVisibleToUser allows public characters and owned private characters', () => {
  const publicChar = makeCharacter('pub', 'alice', CHARACTER_VISIBILITY.PUBLIC);
  const ownedPrivate = makeCharacter('priv_alice', 'alice', CHARACTER_VISIBILITY.PRIVATE);

  const publicResponse = makeResponse([publicChar]);
  const ownedResponse = makeResponse([ownedPrivate]);
  assert.equal(assertCharacterVisibleToUser(publicResponse, 'bob'), publicResponse);
  assert.equal(assertCharacterVisibleToUser(ownedResponse, 'alice'), ownedResponse);
});

test('assertCharacterVisibleToUser rejects an unowned private character with 404', () => {
  const privateChar = makeCharacter('priv_bob', 'bob', CHARACTER_VISIBILITY.PRIVATE);

  assert.throws(
    () => assertCharacterVisibleToUser(makeResponse([privateChar]), 'alice'),
    (error: unknown) => error instanceof ApiError && error.status === 404,
  );
});
