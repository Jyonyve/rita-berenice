import {
  DEFAULT_EMOTION,
  EmotionKey,
  PortraitUrlMap,
  numberToEmotionWordsMap,
  validEmotions,
} from '@rita-berenice/shared/config';

const emotionImageFallbacks: Record<EmotionKey, readonly EmotionKey[]> = {
  0: [0],
  1: [1, 7, 6, 13, 11, 9, 0],
  2: [2, 8, 4, 3, 10, 14, 0],
  3: [3, 10, 4, 14, 2, 0],
  4: [4, 3, 10, 14, 2, 0],
  5: [5, 0],
  6: [6, 13, 1, 7, 11, 9, 0],
  7: [7, 1, 6, 13, 11, 9, 0],
  8: [8, 2, 4, 3, 10, 14, 0],
  9: [9, 1, 7, 6, 11, 13, 0],
  10: [10, 3, 4, 14, 2, 0],
  11: [11, 1, 7, 6, 13, 9, 0],
  12: [12, 0],
  13: [13, 6, 1, 7, 11, 9, 0],
  14: [14, 3, 4, 10, 2, 0],
};

export function getImageNumberForEmotion(emotion: string): EmotionKey {
  const lowerEmotion = emotion.toLowerCase().trim();
  if (validEmotions.has(lowerEmotion)) {
    for (const [numStr, keywords] of Object.entries(numberToEmotionWordsMap)) {
      if ((keywords as readonly string[]).includes(lowerEmotion)) {
        return Number(numStr) as EmotionKey;
      }
    }
  }
  return 0;
}

export function getImageFallbackKeysForEmotion(emotion: string): readonly EmotionKey[] {
  return emotionImageFallbacks[getImageNumberForEmotion(emotion)];
}

export function getDefaultImage(portraits?: PortraitUrlMap): string | undefined {
  return portraits?.[getImageNumberForEmotion(DEFAULT_EMOTION)];
}

export function getImageForEmotion(portraits: PortraitUrlMap | undefined, emotion: string): string | undefined {
  if (!portraits) return undefined;
  for (const fallbackKey of getImageFallbackKeysForEmotion(emotion)) {
    const imageUrl = portraits[fallbackKey];
    if (imageUrl) return imageUrl;
  }
  return undefined;
}

export function getCharacterImageArray(portraits?: PortraitUrlMap): string[] {
  if (!portraits) return [];
  return Object.entries(portraits)
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([, imageUrl]) => imageUrl)
    .filter(Boolean);
}

export function getImageUrl(portraits: PortraitUrlMap | undefined, emotion: string): string | undefined {
  return getImageForEmotion(portraits, emotion);
}
