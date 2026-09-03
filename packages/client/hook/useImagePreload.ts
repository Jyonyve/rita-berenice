import { useEffect } from 'react';

// Module-scoped so navigating between sessions and back does not re-warm URLs the
// browser already holds. Entries are URLs, and a character caps out at 15 portraits
// (emotion keys 0-14), so this stays small.
const warmedUrls = new Set<string>();

/**
 * Pulls an image into the browser cache and decodes it, resolving only once it is
 * ready to paint. Never rejects: a portrait that fails to load should not break the
 * caller's flow, it just means the swap will not be able to wait for it.
 */
export const preloadImage = (url: string | undefined): Promise<void> => {
  if (!url) return Promise.resolve();

  const image = new Image();
  image.src = url;

  // decode() is what makes this worth doing - onload alone can still resolve before
  // the bitmap is paintable, which is exactly the stutter we are trying to remove.
  if (typeof image.decode === 'function') {
    return image.decode().then(
      () => undefined,
      () => undefined,
    );
  }

  return new Promise((resolve) => {
    image.onload = () => resolve();
    image.onerror = () => resolve();
  });
};

/**
 * Warms every given image once, on mount and whenever the set changes. Intended for
 * a character's full portrait set, so later emotion swaps hit a warm cache instead of
 * the network.
 */
export const usePreloadImages = (urls: readonly string[]): void => {
  // Depend on the joined URLs rather than the array identity: callers rebuild the
  // array on every render, and the contents are what actually matter here.
  const urlKey = urls.filter(Boolean).join('\n');

  useEffect(() => {
    if (!urlKey) return;
    for (const url of urlKey.split('\n')) {
      if (warmedUrls.has(url)) continue;
      warmedUrls.add(url);
      void preloadImage(url);
    }
  }, [urlKey]);
};
