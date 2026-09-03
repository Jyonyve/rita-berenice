// src/shared/config/createEmotionCache.ts

import createCache, { EmotionCache } from '@emotion/cache';

// This simple check determines if the code is running in a browser.
const isBrowser = typeof document !== 'undefined';

/**
 * Creates an Emotion cache that is safe for Server-Side Rendering (SSR).
 * On the client, it uses the designated insertion point in the <head>.
 * On the server, it creates a plain cache, as there is no 'document'.
 * @returns {EmotionCache} A configured Emotion cache instance.
 */
export function createEmotionCache(): EmotionCache {
  let insertionPoint: HTMLElement | undefined;

  if (isBrowser) {
    // On the client, we find the meta tag you have in your index.html.
    const emotionInsertionPoint = document.querySelector<HTMLMetaElement>('meta[name="emotion-insertion-point"]');
    // The '??' operator provides a fallback to undefined if the element isn't found.
    insertionPoint = emotionInsertionPoint ?? undefined;
  }

  // On the server, `insertionPoint` will be undefined, which is correct.
  // On the client, it will be the DOM element, which is also correct.
  return createCache({ key: 'mui', insertionPoint });
}
