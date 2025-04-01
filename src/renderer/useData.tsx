import { usePageContext } from './usePageContext';
import type { Data } from '../pages/+data';

export function useData<T extends Data = Data>(): T {
	const pageContext = usePageContext();
	return pageContext.data as T;
}
