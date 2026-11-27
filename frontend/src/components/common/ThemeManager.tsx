import { useEffect } from 'react';
import { useFinoraStore } from '@/stores/useFinoraStore';

export function ThemeManager() {
  const theme = useFinoraStore((s) => s.preferences.theme);

  useEffect(() => {
    const root = document.documentElement;

    const applyTheme = (mode: 'light' | 'dark') => {
      root.classList.toggle('dark', mode === 'dark');
    };

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mq.matches ? 'dark' : 'light');
      const handler = (e: MediaQueryListEvent) => applyTheme(e.matches ? 'dark' : 'light');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }

    applyTheme(theme);
    return undefined;
  }, [theme]);

  return null;
}
