import assert from 'node:assert/strict';
import test from 'node:test';
import {
  boostByQueryTerms,
  extractQueryBoostTerms,
  extractRetrievalBoostTerms,
  hasEarliestEventIntent,
  selectEarliestRelevantMatches,
  selectHighConfidenceQueryMatches,
} from './ragKeywordUtils.js';

test('extractQueryBoostTerms keeps meaningful Korean and numeric tokens', () => {
  const terms = extractQueryBoostTerms('강변동 2동 301호 주소를 듣고 동요했던 장면');

  assert.ok(terms.includes('강변동'));
  assert.ok(terms.includes('2동'));
  assert.ok(terms.includes('301호'));
  assert.ok(terms.includes('주소'));
  assert.equal(terms.includes('듣고'), false);
});

test('extractQueryBoostTerms expands session-glossary aliases bidirectionally', () => {
  const aliases = [{ koreanTerm: '\uC2E0\uD638 \uC7A5\uB9C9', englishTerm: 'Signal Veil' }];
  const koreanTerms = extractQueryBoostTerms('\uC2E0\uD638 \uC7A5\uB9C9', aliases);
  const englishTerms = extractQueryBoostTerms('Signal Veil first meeting', aliases);

  assert.ok(koreanTerms.includes('\uC2E0\uD638 \uC7A5\uB9C9'));
  assert.ok(koreanTerms.includes('signal veil'));
  assert.ok(englishTerms.includes('signal veil'));
  assert.ok(englishTerms.includes('\uC2E0\uD638 \uC7A5\uB9C9'));
});

test('extractQueryBoostTerms does not invent aliases without glossary data', () => {
  const terms = extractQueryBoostTerms('\uC2E0\uD638 \uC7A5\uB9C9');

  assert.ok(terms.includes('\uC2E0\uD638'));
  assert.equal(terms.includes('signal'), false);
});

test('extractQueryBoostTerms never treats known character names as stopwords', () => {
  // Guards against re-introducing character-specific hardcoding into the generic stopword
  // lists (see the '아리' bug removed from queryKeywordStopWords). Add any new character's
  // display name here so a future accidental hardcode is caught automatically.
  const knownCharacterNames = ['아리', '노엘', 'sample_character', 'sample_profile'];

  for (const name of knownCharacterNames) {
    const terms = extractQueryBoostTerms(name);
    assert.ok(terms.includes(name.toLowerCase()), `expected "${name}" to survive stopword filtering`);
  }
});

test('extractRetrievalBoostTerms never treats known character names as stopwords', () => {
  const knownCharacterNames = ['아리', '노엘', 'sample_character', 'sample_profile'];

  for (const name of knownCharacterNames) {
    const terms = extractRetrievalBoostTerms(name, undefined, ['다른참가자']);
    assert.ok(terms.includes(name.toLowerCase()), `expected "${name}" to survive retrieval stopword filtering`);
  }
});

test('retrieval boost terms preserve event terms and exclude participant names', () => {
  const terms = extractRetrievalBoostTerms(
    '외부 신호가 전부 차단되고 긴급 채널만 내게 닿았던 때를 너는 어떻게 기억해?',
    'external signal',
    ['노엘', '아리'],
    [{ koreanTerm: '외부 신호', englishTerm: 'external signal' }],
  );

  assert.equal(terms.includes('노엘'), false);
  assert.equal(terms.includes('아리'), false);
  assert.equal(terms.includes('외부'), true);
  assert.equal(terms.includes('신호'), true);
  assert.equal(terms.includes('외부 신호'), true);
  assert.equal(terms.includes('차단'), true);
  assert.equal(terms.includes('긴급'), true);
  assert.equal(terms.includes('external'), true);
  assert.equal(terms.includes('signal'), true);
  assert.equal(terms.includes('내게'), false);
  assert.equal(terms.includes('너는'), false);
  assert.equal(terms.includes('어떻게'), false);
  assert.equal(terms.includes('기억해'), false);
});

test('raw retrieval terms rank a signal interruption above participant-only noise', () => {
  const terms = extractRetrievalBoostTerms('노엘이 외부 신호를 차단해서 아리의 긴급 채널만 닿은 사건', undefined, [
    '노엘',
    '아리',
  ]);
  const ranked = boostByQueryTerms(
    [
      { id: 'noise', text: '노엘와 아리가 다른 사건에서 대화했다.' },
      { id: 'target', text: '외부 신호를 차단했고 아리의 긴급 채널만 닿았다.' },
    ],
    terms,
    (item) => item.text,
  );

  assert.equal(ranked[0]?.id, 'target');
});

test('extractQueryBoostTerms strips grammatical particles without truncating Korean nouns', () => {
  const terms = extractQueryBoostTerms('숯불구이 식당에서 냉면 먹는 법을 젓가락질을 걱정한 저녁');

  assert.ok(terms.includes('숯불구이'));
  assert.equal(terms.includes('숯불구'), false);
  assert.ok(terms.includes('식당'));
  assert.ok(terms.includes('젓가락질'));
  assert.ok(terms.includes('젓가락질을'));
});

test('boostByQueryTerms preserves original order for equal hit counts', () => {
  const ranked = boostByQueryTerms(
    [
      { id: 'a', text: 'unrelated' },
      { id: 'b', text: '강변동 2동' },
      { id: 'c', text: '강변동 only' },
      { id: 'd', text: 'also unrelated' },
    ],
    ['강변동', '2동'],
    (item) => item.text,
  );

  assert.deepEqual(
    ranked.map((item) => item.id),
    ['b', 'c', 'a', 'd'],
  );
});

test('boostByQueryTerms weights terms rare in the candidate pool above terms common in it', () => {
  const items = [
    { id: 'commonOnly', text: '공통 단어만 있음' },
    { id: 'rareOnly', text: '희귀 단어만 있음' },
    { id: 'both', text: '공통 단어와 희귀 단어 둘 다' },
    { id: 'commonElsewhere', text: '공통 단어 여기도' },
    { id: 'commonAgain', text: '공통 단어 또' },
  ];
  const ranked = boostByQueryTerms(items, ['공통', '희귀'], (item) => item.text);

  // '공통' appears in 4/5 items (low signal), '희귀' appears in 2/5 items (higher signal),
  // so an item matching only the rare term should outrank an item matching only the common
  // term - without either word ever being declared a stopword up front.
  const rareOnlyIndex = ranked.findIndex((item) => item.id === 'rareOnly');
  const commonOnlyIndex = ranked.findIndex((item) => item.id === 'commonOnly');
  assert.ok(rareOnlyIndex < commonOnlyIndex);
});

test('high-confidence query matches exclude lower-overlap event noise', () => {
  const terms = ['외부', '신호', '외부 신호', '차단', '긴급'];
  const selected = selectHighConfidenceQueryMatches(
    [
      { id: 'target', text: '외부 신호 차단 뒤 아리의 긴급 채널이 닿았다.' },
      { id: 'noise', text: '다른 날 노엘의 일반 신호를 받았다.' },
      { id: 'unrelated', text: '두 사람이 대화했다.' },
    ],
    terms,
    (item) => item.text,
    5,
  );

  assert.deepEqual(
    selected.map((item) => item.id),
    ['target'],
  );
});

test('weak lexical evidence preserves the normal result limit', () => {
  const items = [
    { id: 'a', text: '긴급' },
    { id: 'b', text: '신호' },
    { id: 'c', text: '다른 사건' },
  ];
  const selected = selectHighConfidenceQueryMatches(items, ['긴급', '신호'], (item) => item.text, 2);

  assert.deepEqual(
    selected.map((item) => item.id),
    ['a', 'b'],
  );
});

test('earliest-event intent recognizes Korean and English first-event queries', () => {
  assert.equal(hasEarliestEventIntent('처음 만났을 때를 기억해?'), true);
  assert.equal(hasEarliestEventIntent('첫 면담은 어땠어?'), true);
  assert.equal(hasEarliestEventIntent('our first meeting'), true);
  assert.equal(hasEarliestEventIntent('최근 만남은 어땠어?'), false);
});

test('earliest relevant matches prefer the oldest sufficiently matching event', () => {
  const terms = ['북부 관측소', '통제실', '신호 장막', 'signal veil'];
  const selected = selectEarliestRelevantMatches(
    [
      { id: 'later', sequence: 223, text: '북부 관측소 통제실 신호 장막 signal veil' },
      { id: 'first', sequence: 0, text: '북부 관측소 통제실 신호 장막' },
      { id: 'noise', sequence: 1, text: '북부 관측소' },
    ],
    terms,
    (item) => item.text,
    (item) => item.sequence,
    2,
  );

  assert.deepEqual(
    selected.map((item) => item.id),
    ['first', 'later'],
  );
});
