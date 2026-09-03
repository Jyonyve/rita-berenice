import assert from 'node:assert/strict';
import test from 'node:test';
import { detectLanguage } from './languageUtils.js';

test('detectLanguage identifies clear English text before statistical detection', () => {
  assert.equal(detectLanguage('Do you remember our conversation about TypeScript and Java?'), 'eng');
});

test('detectLanguage identifies Korean even when technical English terms are present', () => {
  assert.equal(detectLanguage('TypeScript와 Java 중 무엇을 더 좋아했지?'), 'kor');
});

test('detectLanguage preserves the Korean default for short ambiguous input', () => {
  assert.equal(detectLanguage('ok'), 'kor');
});
