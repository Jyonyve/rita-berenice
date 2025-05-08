// src/shared/util/createEmotionCache.ts

import createCache, { EmotionCache } from '@emotion/cache';

const isBrowser = typeof document !== 'undefined';

// Creates an Emotion cache instance.
// On the client, it tries to use an insertion point for MUI compatibility.
export const createEmotionCache = (): EmotionCache => {
	let insertionPoint: HTMLElement | undefined;

	if (isBrowser) {
		// Client-side: Find the meta tag for precise injection
		const emotionInsertionPoint = document.querySelector<HTMLMetaElement>(
			'meta[name="emotion-insertion-point"]'
		);
		insertionPoint = emotionInsertionPoint ?? undefined;
	}

	// The 'key' helps Emotion identify styles. 'insertionPoint' used client-side.
	return createCache({ key: 'mui-style', insertionPoint }); // Use consistent key 'mui-style'
};
