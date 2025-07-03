import createCache from '@emotion/cache';

export const createEmotionCache = () => {
	let insertionPoint: HTMLElement | undefined;

	if (typeof document !== 'undefined') {
		// Only assign if the element is actually an HTMLElement
		const emotionInsertionPoint = document.querySelector('meta[name="emotion-insertion-point"]');
		if (emotionInsertionPoint && emotionInsertionPoint instanceof HTMLElement) {
			insertionPoint = emotionInsertionPoint;
		}
		// If not found or not HTMLElement, insertionPoint remains undefined
	}

	// Use key: 'mui' for MUI SSR compatibility!
	return createCache({ key: 'mui', insertionPoint }); // console error는  dev에서만 나는것
};
