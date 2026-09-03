import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCharacterGlossarySource, createCharacterGlossaryJobService } from './characterGlossaryJobService.js';

const waitForTerminalStatus = async (
  service: ReturnType<typeof createCharacterGlossaryJobService>,
  characterId: string,
) => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const snapshot = service.get(characterId);
    if (snapshot?.status === 'completed' || snapshot?.status === 'failed') return snapshot;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('Character glossary job did not complete.');
};

test('buildCharacterGlossarySource includes character baseline text', () => {
  const source = buildCharacterGlossarySource({
    name: '아리',
    showName: '강아리',
    title: '이세계의 영웅',
    worldIntroduction: '북부 관측소와 통제실이 존재한다.',
    description: '신호 장막을 분석하는 조사관.',
    instruction: '아리의 관점으로 응답한다.',
  });

  assert.match(source, /북부 관측소/);
  assert.match(source, /신호 장막/);
  assert.match(source, /아리의 관점/);
});

test('character glossary jobs deduplicate unchanged source text', async () => {
  let callCount = 0;
  const service = createCharacterGlossaryJobService(async (input) => {
    callCount += 1;
    return { characterId: input.characterId, extractedTermCount: 2, resolvedTermCount: 2 };
  });
  const input = { characterId: 'sample_character', userId: 'user', sourceText: '북부 관측소' };

  const first = service.enqueue(input);
  const second = service.enqueue(input);
  const completed = await waitForTerminalStatus(service, input.characterId);

  assert.equal(first.jobId, second.jobId);
  assert.equal(completed.status, 'completed');
  assert.equal(callCount, 1);
});

test('character glossary jobs rescan changed baseline text', async () => {
  let callCount = 0;
  const service = createCharacterGlossaryJobService(async (input) => {
    callCount += 1;
    return { characterId: input.characterId, extractedTermCount: 1, resolvedTermCount: 1 };
  });

  service.enqueue({ characterId: 'sample_character', userId: 'user', sourceText: '북부 관측소' });
  await waitForTerminalStatus(service, 'sample_character');
  service.enqueue({
    characterId: 'sample_character',
    userId: 'user',
    sourceText: '북부 관측소와 통제실',
  });
  await waitForTerminalStatus(service, 'sample_character');

  assert.equal(callCount, 2);
});
