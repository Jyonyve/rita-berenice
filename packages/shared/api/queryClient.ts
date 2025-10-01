// 불필요한 toast 없이 기본적인 QueryClient 설정만
import { QueryClient } from '@tanstack/react-query';

export function initQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 60 * 1000, // 1분
				refetchOnWindowFocus: false,
			},
			mutations: {},
		},
	});
}
