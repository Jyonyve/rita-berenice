// src/client/layout/ReloadToHome.tsx
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';

export default function ReloadToHome() {
	const nav = useNavigate();
	const loc = useLocation();

	useEffect(() => {
		// Detect hard reloads
		const isReload =
			(performance as any).navigation?.type === 1 ||
			performance.getEntriesByType?.('navigation')?.some?.((e: any) => e.type === 'reload');

		if (isReload) {
			// Avoid redirect loop on home
			if (loc.pathname !== '/') {
				nav('/', { replace: true });
			}
		}
	}, [nav, loc.pathname]);

	return null;
}
