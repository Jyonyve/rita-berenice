import type { OnHydrationEndAsync } from 'vike/types';

export const onHydrationEnd: OnHydrationEndAsync = async (): ReturnType<OnHydrationEndAsync> => {
	console.log('Hydration finished; page is now interactive.');
};
