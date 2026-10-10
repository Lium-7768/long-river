'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { type Dynasty } from '@/content/dynasties';
import { ThemeToggle } from '@/components/theme-toggle';

// Three.js 依赖 window，必须禁用 SSR
const Timeline = dynamic(() => import('@/components/canvas/Timeline').then((m) => m.Timeline), {
  ssr: false,
  loading: () => <div className="animate-pulse-glow text-lr-muted">载入时间长河…</div>,
});

export default function Home() {
  const [picked, setPicked] = useState<Dynasty | null>(null);

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      {/* 顶栏 */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-8 py-6">
        <div>
          <h1 className="text-glow text-2xl font-semibold tracking-[0.3em] text-lr-accent">长河</h1>
          <p className="mt-1 text-xs tracking-[0.35em] text-lr-muted">CHINESE HISTORY · 3D</p>
        </div>
        <ThemeToggle />
      </header>

      {/* 第一层：时间长河（严格只显示此层） */}
      {!picked && (
        <>
          <div className="absolute inset-0 z-0">
            <Timeline onSelect={setPicked} />
          </div>
          <p className="pointer-events-none absolute bottom-8 left-1/2 z-10 -translate-x-1/2 text-xs tracking-[0.4em] text-lr-muted">
            拖动浏览 · 点击有数据的朝代进入
          </p>
        </>
      )}

      {/* 第二层占位（下一步实现） */}
      {picked && (
        <div className="relative z-10 flex h-full flex-col items-center justify-center gap-4">
          <p className="text-sm tracking-widest text-lr-muted">你选择了</p>
          <h2 className="text-glow text-5xl font-semibold text-lr-accent">{picked.name}</h2>
          <p className="text-sm text-lr-muted">
            {picked.start < 0 ? `前${-picked.start}` : picked.start} – {picked.end} ｜ {picked.note}
          </p>
          <button
            onClick={() => setPicked(null)}
            className="gear-border mt-6 rounded-full px-6 py-2 text-xs tracking-widest text-lr-fg/80 hover:text-lr-accent"
          >
            ← 返回时间长河
          </button>
          <p className="mt-8 text-[10px] tracking-[0.3em] text-lr-muted">
            第二层「分类星群」下一步实现
          </p>
        </div>
      )}
    </main>
  );
}
