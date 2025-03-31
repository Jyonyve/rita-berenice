import type { OnPageTransitionStartAsync } from 'vike/types';

export const onPageTransitionStart: OnPageTransitionStartAsync =
	async (): ReturnType<OnPageTransitionStartAsync> => {
		console.log('Page transition start');
		document.querySelector('body')!.classList.add('page-is-transitioning');
	};
