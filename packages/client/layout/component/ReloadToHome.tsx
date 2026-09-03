// src/client/layout/ReloadToHome.tsx
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';

export default function ReloadToHome() {
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    // If we've already handled a reload in this session, do nothing
    if (sessionStorage.getItem('rb:handledReload') === '1') return;

    // Detect true hard reloads only
    // 1) Legacy: performance.navigation.type === 1
    // 2) NT2: any navigation entry with type === 'reload'
    const isHardReload =
      (performance as any).navigation?.type === 1 ||
      performance.getEntriesByType?.('navigation')?.some?.((e: any) => e.type === 'reload');

    if (isHardReload) {
      sessionStorage.setItem('rb:handledReload', '1');
      if (loc.pathname !== '/') {
        nav('/', { replace: true });
      }
    }
  }, [nav, loc.pathname]);

  return null;
}
