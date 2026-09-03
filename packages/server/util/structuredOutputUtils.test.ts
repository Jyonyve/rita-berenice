import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import { parseStructuredLlmOutput, StructuredOutputValidationError } from './structuredOutputUtils.js';

const responseSchema = z.object({
  response: z.string().min(1),
  emotion: z.enum(['neutral', 'happy']),
});

test('parseStructuredLlmOutput validates raw JSON', () => {
  const result = parseStructuredLlmOutput('{"response":"Hello","emotion":"happy"}', responseSchema);

  assert.deepEqual(result, { response: 'Hello', emotion: 'happy' });
});

test('parseStructuredLlmOutput extracts case-insensitive fenced JSON', () => {
  const result = parseStructuredLlmOutput('```JSON\r\n{"response":"Hello","emotion":"neutral"}\r\n```', responseSchema);

  assert.equal(result.emotion, 'neutral');
});

test('parseStructuredLlmOutput rejects schema-invalid JSON and preserves raw output for repair', () => {
  const rawOutput = '{"response":"Hello","emotion":"angry"}';

  assert.throws(
    () => parseStructuredLlmOutput(rawOutput, responseSchema),
    (error: unknown) =>
      error instanceof StructuredOutputValidationError &&
      error.rawOutput === rawOutput &&
      error.message === 'The model response did not match the required schema.',
  );
});

test('parseStructuredLlmOutput rejects empty and malformed output', () => {
  assert.throws(() => parseStructuredLlmOutput('', responseSchema), StructuredOutputValidationError);
  assert.throws(() => parseStructuredLlmOutput('not-json', responseSchema), StructuredOutputValidationError);
});
