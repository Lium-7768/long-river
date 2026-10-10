'use client';

/**
 * G · 极简（Apple 官网式）
 * 核心：大量留白 + 巨大清晰的中文 + 克制配色 + 微妙动效。
 * 文字全部 DOM 渲染（绝对清晰）。无 WebGL。
 */
import { useState } from 'react';
import { DYNASTIES, DYNASTIES_WITH_DATA, type Dynasty } from '@/content/dynasties';

const hasData = (id: string) => DYNASTIES_WITH_DATA.has(id);

function fmt(y: number) {
  return y < 0 ? `前${-y}` : `${y}`;
}

export default function MinimalPage() {
  const [sel, setSel] = useState<Dynasty | null>(null);

  return (
    <main className="min-h-screen bg-white text-neutral-900 antialiased">
      {/* 顶栏：极简 */}
      <header className="sticky top-0 z-20 border-b border-neutral-200/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <span className="text-[15px] font-semibold tracking-tight">长河</span>
          <nav className="flex gap-8 text-[13px] text-neutral-600">
            <span className="cursor-default transition-colors hover:text-neutral-900">朝代</span>
            <span className="cursor-default transition-colors hover:text-neutral-900">人物</span>
            <span className="cursor-default transition-colors hover:text-neutral-900">事件</span>
          </nav>
        </div>
      </header>

      {/* Hero：巨大标题 + 留白 */}
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-28 text-center">
        <h1 className="text-[64px] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[88px]">
          中国历史
          <br />
          <span className="text-neutral-400">如长河奔流</span>
        </h1>
        <p className="mx-auto mt-8 max-w-xl text-[19px] leading-relaxed text-neutral-500">
          从公元前 2070 到 1912，三千九百余年。
          <br />
          点击任一朝代，走近它的人物与故事。
        </p>
      </section>

      {/* 朝代列表：Apple 式大卡片 / 清晰排版 */}
      <section className="mx-auto max-w-6xl px-6 pb-40">
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-3xl bg-neutral-200 sm:grid-cols-2 lg:grid-cols-3">
          {DYNASTIES.map((d) => {
            const usable = hasData(d.id);
            const active = sel?.id === d.id;
            return (
              <button
                key={d.id}
                disabled={!usable}
                onClick={() => setSel(active ? null : d)}
                className={[
                  'group relative flex flex-col justify-between p-8 text-left transition-all duration-500',
                  usable ? 'cursor-pointer' : 'cursor-default',
                  active ? 'bg-neutral-900 text-white' : 'bg-white',
                  usable && !active ? 'hover:bg-neutral-50' : '',
                ].join(' ')}
                style={{ minHeight: '176px' }}
              >
                <div className="flex items-start justify-between">
                  <span
                    className={[
                      'text-[40px] font-semibold leading-none tracking-tight transition-colors',
                      active ? 'text-white' : usable ? 'text-neutral-900' : 'text-neutral-300',
                    ].join(' ')}
                  >
                    {d.name}
                  </span>
                  {usable && (
                    <span
                      className={[
                        'mt-2 h-2 w-2 rounded-full transition-all duration-500',
                        active ? 'bg-white' : 'bg-blue-500',
                      ].join(' ')}
                    />
                  )}
                </div>
                <div>
                  <div
                    className={[
                      'text-[13px] tabular-nums tracking-wide transition-colors',
                      active ? 'text-white/70' : usable ? 'text-neutral-500' : 'text-neutral-300',
                    ].join(' ')}
                  >
                    {fmt(d.start)} – {fmt(d.end)}
                  </div>
                  <div
                    className={[
                      'mt-1 text-[13px] transition-colors',
                      active ? 'text-white/90' : usable ? 'text-neutral-500' : 'text-neutral-300',
                    ].join(' ')}
                  >
                    {usable ? d.note : '待补充'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* 展开区：选中朝代后 */}
        <div
          className={[
            'overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]',
            sel ? 'mt-16 max-h-[300px] opacity-100' : 'mt-0 max-h-0 opacity-0',
          ].join(' ')}
        >
          {sel && (
            <div className="rounded-3xl bg-neutral-50 p-12 text-center">
              <div className="text-[13px] font-medium uppercase tracking-[0.2em] text-neutral-400">
                {fmt(sel.start)} – {fmt(sel.end)}
              </div>
              <h2 className="mt-4 text-[56px] font-semibold tracking-tight">{sel.name}</h2>
              <p className="mx-auto mt-4 max-w-lg text-[17px] text-neutral-500">{sel.note}</p>
              <p className="mt-8 text-[13px] text-neutral-400">第二层「人物与事件」即将呈现</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
