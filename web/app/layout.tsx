import type { Metadata, Viewport } from 'next';
import { ThemeProvider } from '@/components/theme-provider';
import { LenisProvider } from '@/components/lenis-provider';
import { InkTransitionHost } from '@/components/ink-transition';
import './globals.css';

export const metadata: Metadata = {
  title: '长河 · 中国历史',
  description: '把中国历史用 3D 展示出来 —— 朝代 · 人物 · 事件',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#05070d',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="theme-deep" data-theme="deep" suppressHydrationWarning>
      <body>
        <LenisProvider />
        <InkTransitionHost />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
