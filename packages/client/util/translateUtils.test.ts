import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_LANG, LANG_KEYS } from '@rita-berenice/shared/config';
import { getCurrentLang, getLangText, initializeTranslationLanguage } from './translateUtils.js';

test('translation bootstrap uses the same explicit language for the initial render', () => {
  assert.equal(initializeTranslationLanguage('eng'), 'eng');
  assert.equal(getCurrentLang(), 'eng');
  assert.equal(getLangText(LANG_KEYS.CHARACTERS), 'Characters');

  assert.equal(initializeTranslationLanguage('kor'), 'kor');
  assert.equal(getCurrentLang(), 'kor');
  assert.equal(getLangText(LANG_KEYS.CHARACTERS), '캐릭터');
});

test('translation bootstrap rejects invalid serialized language values', () => {
  assert.equal(initializeTranslationLanguage('invalid'), DEFAULT_LANG);
  assert.equal(getCurrentLang(), DEFAULT_LANG);
});
