'use client';

/**
 * 视觉方向实验室 —— 同一份朝代数据，4 种截然不同的呈现。
 * 用 ?v=river|carousel|constellation|scroll 切换，或点顶部按钮。
 * 目的：快速选定"好看"的方向，再据此精做。
 */
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { DYNASTIES } from '@/content/dynasties';

const variants = {
  river: dynamic(() => import('@/components/lab/River').then((m) => m.River), { ssr: false }),
  carousel: dynamic(() => import('@/components/lab/Carousel').then((m) => m.Carousel), {
    ssr: false,
  }),
  constellation: dynamic(
    () => import('@/components/lab/Constellation').then((m) => m.Constellation),
    { ssr: false },
  ),
  scroll: dynamic(() => import('@/components/lab/Scroll').then((m) => m.Scroll), { ssr: false }),
};

const INFO: Record<string, { name: string; desc: string }> = {
  river: { name: 'A · 时间长河', desc: '45°俯瞰，朝代如河心浮岛，向远方延伸' },
  carousel: { name: 'B · 时间转轮', desc: '环形赛道，相机绕行，像操作一台仪表盘' },
  constellation: { name: 'C · 星汉', desc: '朝代=星辰，按时间排布于深空，连线成星座' },
  scroll: { name: 'D · 卷轴', desc: '平铺长卷，横向滑动，博物馆展签式' },
};

function LabInner() {
  const sp = useSearchParams();
  const v = sp.get('v') || 'river';
  const Comp = variants[v as keyof typeof variants] || variants.river;

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <div className="absolute inset-0 z-0">
        <Comp onSelect={() => {}} />
      </div>

      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-6 py-4">
        <div className="pointer-events-auto">
          <h1 className="text-glow text-lg font-semibold tracking-[0.3em] text-lr-accent">
            长河 · 视觉实验室
          </h1>
          <p className="mt-0.5 text-[10px] tracking-[0.2em] text-lr-muted">
            {INFO[v]?.name} — {INFO[v]?.desc}
          </p>
        </div>
        <nav className="pointer-events-auto flex gap-2">
          {Object.entries(INFO).map(([k, info]) => (
            <a
              key={k}
              href={`/lab?v=${k}`}
              className={`gear-border rounded-full px-3 py-1 text-[10px] tracking-widest transition-colors ${
                k === v ? 'text-lr-accent' : 'text-lr-muted hover:text-lr-fg'
              }`}
            >
              {info.name}
            </a>
          ))}
        </nav>
      </header>
      <div className="pointer-events-none absolute bottom-4 left-6 z-20 text-[10px] tracking-[0.2em] text-lr-muted">
        共 {DYNASTIES.length} 朝代 · 公元前 2070 – 1912
      </div>
    </main>
  );
}

export default function LabPage() {
  return (
    <Suspense fallback={<div className="p-8 text-lr-muted">载入…</div>}>
      <LabInner />
    </Suspense>
  );
}
