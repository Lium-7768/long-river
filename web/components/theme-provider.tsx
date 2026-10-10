'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type ThemeName = 'deep' | 'ink';

type Ctx = { theme: ThemeName; setTheme: (t: ThemeName) => void; toggle: () => void };
const ThemeCtx = createContext<Ctx>({ theme: 'deep', setTheme: () => {}, toggle: () => {} });

const STORAGE_KEY = 'lr-theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>('deep');

  // 初始化：读 localStorage / 系统偏好
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeName | null;
    if (saved === 'deep' || saved === 'ink') {
      setThemeState(saved);
    } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      setThemeState('ink');
    }
  }, []);

  // 应用到 <html>，供 Tailwind 与 lib/theme.ts 读取
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-deep', 'theme-ink');
    root.classList.add(`theme-${theme}`);
    root.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
    window.dispatchEvent(new CustomEvent('lr-theme-change', { detail: theme }));
  }, [theme]);

  const value: Ctx = {
    theme,
    setTheme: setThemeState,
    toggle: () => setThemeState((t) => (t === 'deep' ? 'ink' : 'deep')),
  };
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  return useContext(ThemeCtx);
}
