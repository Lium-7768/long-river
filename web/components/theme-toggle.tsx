'use client';

import { useTheme } from './theme-provider';
import { cn } from '@/lib/utils';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      className={cn(
        'gear-border pointer-events-auto rounded-full px-4 py-1.5 text-xs tracking-widest',
        'text-lr-fg/80 transition-colors hover:text-lr-accent',
        className,
      )}
      aria-label="切换主题"
    >
      【{theme === 'deep' ? '深空' : '水墨'}】主题
    </button>
  );
}
