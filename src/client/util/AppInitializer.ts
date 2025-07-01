import { useEffect } from 'react';
import { useToast } from '../style/ToastProvider.tsx';
import { setupApiClient } from './clientHelpers.ts';


export const AppInitializer = () => {
	const { addToast } = useToast();

	useEffect(() => {
		setupApiClient(addToast); // 안전하게 주입
	}, [addToast]);

	return null; // 이건 초기화용 컴포넌트니까 렌더링 안 해도 됨
};
