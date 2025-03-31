import type { OnPageTransitionStartAsync, OnPageTransitionEndAsync } from 'vike/types';

export const onPageTransitionEnd: OnPageTransitionEndAsync =
	async (): ReturnType<OnPageTransitionEndAsync> => {
		console.log('Page transition end');
		document.querySelector('body')!.classList.remove('page-is-transitioning');
	};
