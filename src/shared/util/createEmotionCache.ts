// src/utils/createEmotionCache.ts
import createCache from '@emotion/cache';

// Define the consistent key for your cache
export const emotionCacheKey = 'emotion-css-cache';

/**
 * Creates a new Emotion cache instance.
 * Use 'prepend: true' for MUI compatibility, allowing easier style overrides.
 */
export default function createEmotionCache() {
	// Use prepend: true consistently based on client-side usage and MUI recommendations
	return createCache({ key: emotionCacheKey, prepend: true });
}
