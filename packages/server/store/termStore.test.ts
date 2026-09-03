import assert from 'node:assert/strict';
import test from 'node:test';
import { METADATA_TYPES } from '@rita-berenice/shared/config';
import { CharacterTermInfo, SessionTermInfo } from '@rita-berenice/shared/domain';
import { mergeTermScopes } from './termStore.js';

const characterTerm = (koreanTerm: string, englishTerm: string): CharacterTermInfo => ({
  termId: `character_${koreanTerm}`,
  type: METADATA_TYPES.CHARACTER,
  characterId: 'sample_character',
  koreanTerm,
  englishTerm,
  initialTerm: englishTerm,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const sessionTerm = (koreanTerm: string, englishTerm: string): SessionTermInfo => ({
  termId: `session_${koreanTerm}`,
  type: METADATA_TYPES.SESSION,
  characterId: 'sample_character',
  sessionId: 'sample_character_session',
  koreanTerm,
  englishTerm,
  initialTerm: englishTerm,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

test('mergeTermScopes includes reusable character terms and session-only terms', () => {
  const merged = mergeTermScopes(
    [characterTerm('북부 관측소', 'North Observatory')],
    [sessionTerm('프로메테우스', 'Prometheus')],
  );

  assert.deepEqual(
    merged.map(({ koreanTerm, englishTerm }) => [koreanTerm, englishTerm]),
    [
      ['북부 관측소', 'North Observatory'],
      ['프로메테우스', 'Prometheus'],
    ],
  );
});

test('mergeTermScopes gives session terms precedence over character defaults', () => {
  const merged = mergeTermScopes(
    [characterTerm('신호 장막', 'Signal Veil')],
    [sessionTerm('신호 장막', 'Session Signal Veil')],
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.englishTerm, 'Session Signal Veil');
  assert.equal(merged[0]?.type, METADATA_TYPES.SESSION);
});
