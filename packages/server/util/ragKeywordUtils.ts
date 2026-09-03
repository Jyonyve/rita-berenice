const queryKeywordStopWords = new Set([
  '가',
  '과',
  '그',
  '그가',
  '그를',
  '그의',
  '그때',
  '나는',
  '내가',
  '너',
  '너를',
  '듣고',
  '때문',
  '법',
  '법을',
  '본',
  '수',
  '순간',
  '일',
  '장면',
  '저녁',
  '했던',
]);

export interface RetrievalTermAlias {
  koreanTerm: string;
  englishTerm: string;
}

const retrievalQuestionStopWords = new Set([
  '기억',
  '기억해',
  '내게',
  '너는',
  '때',
  '때를',
  '사건',
  '어떻게',
  '있게',
  '전부',
]);

const koreanPredicateEndings = ['거든', '는데', '되고', '되며', '해서', '했던', '하는', '였다', '했다'];

const hasKoreanFinalConsonant = (character: string): boolean => {
  const codePoint = character.codePointAt(0);
  if (codePoint === undefined || codePoint < 0xac00 || codePoint > 0xd7a3) return false;
  return (codePoint - 0xac00) % 28 !== 0;
};

const singleCharacterParticleFinalConsonant = new Map<string, boolean>([
  ['은', true],
  ['이', true],
  ['을', true],
  ['과', true],
  ['는', false],
  ['가', false],
  ['를', false],
  ['와', false],
]);

const stripKoreanParticle = (term: string): string => {
  const particles = [
    '으로',
    '에서',
    '에게',
    '께서',
    '부터',
    '까지',
    '처럼',
    '마다',
    '보다',
    '하고',
    '이랑',
    '랑',
    '은',
    '는',
    '이',
    '가',
    '을',
    '를',
    '에',
    '의',
    '와',
    '과',
    '로',
    '만',
    '도',
  ];
  const particle = particles.find((candidate) => term.endsWith(candidate));
  if (!particle || term.length - particle.length < 2) return term;
  const requiresFinalConsonant = singleCharacterParticleFinalConsonant.get(particle);
  if (requiresFinalConsonant !== undefined) {
    const stemLastCharacter = term.at(-(particle.length + 1));
    if (!stemLastCharacter || hasKoreanFinalConsonant(stemLastCharacter) !== requiresFinalConsonant) {
      return term;
    }
  }
  return term.slice(0, -particle.length);
};

const stripKoreanPredicateEnding = (term: string): string => {
  const ending = koreanPredicateEndings.find((candidate) => term.endsWith(candidate));
  if (!ending || term.length - ending.length < 2) return term;
  return term.slice(0, -ending.length);
};

export const extractQueryBoostTerms = (queries: string | string[], aliases: RetrievalTermAlias[] = []): string[] => {
  const values = Array.isArray(queries) ? queries : [queries];
  const terms = new Set<string>();
  for (const value of values) {
    const tokens = value.match(/[\p{L}\p{N}_-]+/gu) ?? [];
    for (const token of tokens) {
      const normalized = token.toLowerCase();
      const stripped = stripKoreanParticle(normalized);
      if (stripped.length < 2 || queryKeywordStopWords.has(normalized) || queryKeywordStopWords.has(stripped)) {
        continue;
      }
      terms.add(normalized);
      terms.add(stripped);
    }
  }

  for (const { koreanTerm, englishTerm } of aliases) {
    const korean = koreanTerm.trim().toLowerCase();
    const english = englishTerm.trim().toLowerCase();
    if (!korean || !english) continue;
    const aliasMentioned = values.some((value) => {
      const normalizedValue = value.toLowerCase();
      return normalizedValue.includes(korean) || normalizedValue.includes(english);
    });
    if (!aliasMentioned) continue;

    terms.add(korean);
    terms.add(english);
  }
  return [...terms];
};

export const extractRetrievalBoostTerms = (
  userQuery: string,
  criticalTerm: string | undefined,
  participantNames: string[],
  aliases: RetrievalTermAlias[] = [],
): string[] => {
  const excludedTerms = new Set(extractQueryBoostTerms(participantNames));
  const canonicalize = (term: string): string => stripKoreanPredicateEnding(stripKoreanParticle(term.toLowerCase()));
  const terms = new Set(
    extractQueryBoostTerms([userQuery, criticalTerm ?? ''], aliases)
      .map(canonicalize)
      .filter((term) => term.length >= 2 && !excludedTerms.has(term) && !retrievalQuestionStopWords.has(term)),
  );

  for (const value of [userQuery, criticalTerm ?? '']) {
    const phraseTokens = (value.match(/[\p{L}\p{N}_-]+/gu) ?? [])
      .map(canonicalize)
      .filter((term) => term.length >= 2 && !excludedTerms.has(term) && !retrievalQuestionStopWords.has(term));
    for (let index = 0; index < phraseTokens.length - 1; index += 1) {
      terms.add(`${phraseTokens[index]} ${phraseTokens[index + 1]}`);
    }
  }

  return [...terms];
};

export const countQueryTermHits = (text: string, terms: string[]): number => {
  const normalizedText = text.toLowerCase();
  return terms.filter((term) => normalizedText.includes(term.toLowerCase())).length;
};

// Down-weights terms that are common across the current candidate pool and up-weights
// terms that are rare in it, so a term doesn't need to be pre-declared as a stopword to
// stop dominating the boost score - it only needs to actually be uninformative for this query.
const computeLocalTermWeights = <T>(
  items: T[],
  terms: string[],
  toSearchText: (item: T) => string,
): Map<string, number> => {
  const normalizedTexts = items.map((item) => toSearchText(item).toLowerCase());
  const weights = new Map<string, number>();
  for (const term of terms) {
    const lowerTerm = term.toLowerCase();
    const documentFrequency = normalizedTexts.filter((text) => text.includes(lowerTerm)).length;
    weights.set(term, Math.log((items.length + 1) / (documentFrequency + 1)) + 1);
  }
  return weights;
};

const countWeightedQueryTermHits = (text: string, terms: string[], weights: Map<string, number>): number => {
  const normalizedText = text.toLowerCase();
  return terms.reduce((score, term) => {
    if (!normalizedText.includes(term.toLowerCase())) return score;
    return score + (weights.get(term) ?? 1);
  }, 0);
};

export const boostByQueryTerms = <T>(items: T[], terms: string[], toSearchText: (item: T) => string): T[] => {
  if (!items.length || !terms.length) return items;

  const weights = computeLocalTermWeights(items, terms, toSearchText);
  return items
    .map((item, index) => ({
      item,
      index,
      weightedScore: countWeightedQueryTermHits(toSearchText(item), terms, weights),
    }))
    .sort((left, right) => right.weightedScore - left.weightedScore || left.index - right.index)
    .map(({ item }) => item);
};

export const selectHighConfidenceQueryMatches = <T>(
  items: T[],
  terms: string[],
  toSearchText: (item: T) => string,
  limit: number,
): T[] => {
  const limitedItems = items.slice(0, limit);
  if (!limitedItems.length || !terms.length) return limitedItems;

  const scoredItems = limitedItems.map((item) => ({
    item,
    hitCount: countQueryTermHits(toSearchText(item), terms),
  }));
  const topHitCount = scoredItems[0]?.hitCount ?? 0;
  if (topHitCount < 4) return limitedItems;

  const minimumHitCount = Math.max(3, topHitCount - 1);
  return scoredItems.filter(({ hitCount }) => hitCount >= minimumHitCount).map(({ item }) => item);
};

export const hasEarliestEventIntent = (query: string): boolean =>
  /(?:^|\s)(?:처음|첫(?=\s)|first|initial)(?:\s|$)/iu.test(query);

export const selectEarliestRelevantMatches = <T>(
  items: T[],
  terms: string[],
  toSearchText: (item: T) => string,
  getSequence: (item: T) => number,
  limit: number,
): T[] => {
  if (!items.length || !terms.length) return items.slice(0, limit);

  const scoredItems = items.map((item, index) => ({
    item,
    index,
    hitCount: countQueryTermHits(toSearchText(item), terms),
  }));
  const topHitCount = Math.max(...scoredItems.map(({ hitCount }) => hitCount));
  if (topHitCount < 3) return items.slice(0, limit);

  const minimumHitCount = Math.max(1, topHitCount - 2);
  return scoredItems
    .filter(({ hitCount }) => hitCount >= minimumHitCount)
    .sort(
      (left, right) =>
        getSequence(left.item) - getSequence(right.item) || right.hitCount - left.hitCount || left.index - right.index,
    )
    .slice(0, limit)
    .map(({ item }) => item);
};
