'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { type Dynasty } from '@/content/dynasties';
import { DynastyView } from '@/components/DynastyView';
import { ThemeToggle } from '@/components/theme-toggle';

const Timeline = dynamic(() => import('@/components/canvas/Timeline').then((m) => m.Timeline), {
  ssr: false,
  loading: () => <div className="animate-pulse-glow text-lr-muted">载入时间长河…</div>,
});

export default function Home() {
  const [picked, setPicked] = useState<Dynasty | null>(null);

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      {/* 顶栏（仅第一层显示，第二层自带顶栏） */}
      {!picked && (
        <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-8 py-6">
          <div>
            <h1 className="text-glow text-2xl font-semibold tracking-[0.3em] text-lr-accent">
              长河
            </h1>
            <p className="mt-1 text-xs tracking-[0.35em] text-lr-muted">CHINESE HISTORY · 3D</p>
          </div>
          <ThemeToggle />
        </header>
      )}

      {/* 第一层：时间长河 */}
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

      {/* 第二层：朝代内容 */}
      {picked && <DynastyView dynasty={picked} onPick={() => {}} onBack={() => setPicked(null)} />}
    </main>
  );
}
