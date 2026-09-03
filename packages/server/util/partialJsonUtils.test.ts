import assert from 'node:assert/strict';
import test from 'node:test';
import { PartialJsonStringDecoder, extractPartialJsonString } from './partialJsonUtils.js';

test('extractPartialJsonString decodes a partial response value', () => {
  assert.equal(extractPartialJsonString('{"response":"Hello\\nworld","emotion":', 'response'), 'Hello\nworld');
});

test('PartialJsonStringDecoder emits only newly decoded text across arbitrary chunks', () => {
  const decoder = new PartialJsonStringDecoder('response');
  const chunks = ['```json\n{"res', 'ponse":"Hel', 'lo\\n', 'world","emotion":"happy"}\n```'];

  assert.deepEqual(
    chunks.map((chunk) => decoder.push(chunk)),
    ['', 'Hel', 'lo\n', 'world'],
  );
});

test('PartialJsonStringDecoder waits for a complete unicode escape', () => {
  const decoder = new PartialJsonStringDecoder('response');

  assert.equal(decoder.push('{"response":"A\\u00'), 'A');
  assert.equal(decoder.push('42B"}'), 'BB');
});
