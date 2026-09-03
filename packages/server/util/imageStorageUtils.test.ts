import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCharacterPortraitUrls,
  buildCharacterAvatarUrls,
  buildHistoryImageUrl,
  getCharacterPortraitUrls,
} from './imageStorageUtils.js';

test('buildCharacterPortraitUrls filters unrelated files and prefers current WebP portraits', () => {
  assert.deepEqual(
    buildCharacterPortraitUrls('sample_character', [
      'sample_character_0.webp',
      'sample_character_0.avif',
      'sample_character_1.png',
      'sample_character_99.avif',
      'sample_character_notes.txt',
      'other_2.avif',
    ]),
    {
      0: '/assets/character/sample_character/sample_character_0.webp',
      1: '/assets/character/sample_character/sample_character_1.png',
    },
  );
});

test('portrait and avatar discovery keep paired emotion assets separate', () => {
  const files = [
    'sample_character_0.avif',
    'sample_character_0_a.webp',
    'sample_character_0_a.avif',
    'sample_character_1_a.png',
  ];
  assert.deepEqual(buildCharacterPortraitUrls('sample_character', files), {
    0: '/assets/character/sample_character/sample_character_0.avif',
  });
  assert.deepEqual(buildCharacterAvatarUrls('sample_character', files), {
    0: '/assets/character/sample_character/sample_character_0_a.webp',
    1: '/assets/character/sample_character/sample_character_1_a.png',
  });
});

test('buildCharacterPortraitUrls URL-encodes runtime path segments', () => {
  assert.deepEqual(buildCharacterPortraitUrls('character one', ['character one_0.avif']), {
    0: '/assets/character/character%20one/character%20one_0.avif',
  });
});

test('image discovery appends storage versions without changing deterministic object paths', () => {
  assert.deepEqual(
    buildCharacterPortraitUrls('sample_character', ['sample_character_0.avif', 'sample_character_0.webp'], {
      'sample_character_0.avif': 'etag-v2',
      'sample_character_0.webp': 'webp-etag',
    }),
    { 0: '/assets/character/sample_character/sample_character_0.webp?v=webp-etag' },
  );
});

test('buildHistoryImageUrl returns the preferred matching history image', () => {
  assert.equal(
    buildHistoryImageUrl('character one', 'history one', ['history one.webp', 'history one.avif', 'other.avif']),
    '/assets/character/character%20one/lore/history%20one.webp',
  );
  assert.equal(buildHistoryImageUrl('character one', 'missing', ['other.avif']), undefined);
});

test('getCharacterPortraitUrls returns an empty map for a missing character directory', async () => {
  assert.deepEqual(await getCharacterPortraitUrls('__missing_character_storage_test__'), {});
});
