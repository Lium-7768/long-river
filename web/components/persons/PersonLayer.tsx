'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Search } from 'lucide-react';
import type { PersonBrief } from '@/lib/api';
import { DYNASTIES } from '@/content/dynasties';
import { useDynastyPersons, usePersonSearch } from './use-persons';

const PersonStarScene = dynamic(() => import('./PersonStarScene').then((m) => m.PersonStarScene), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-white/30">星群生成中…</div>
  ),
});

const DYNASTY_NAME: Record<string, string> = Object.fromEntries(
  DYNASTIES.map((d) => [d.id, d.name]),
);

/**
 * 第二层：朝代 → 人物星群。
 * 顶部：返回 + 朝代名 + 代表人物数
 * 中间：3D 星群
 * 底部：搜索框（搜全部朝代的人）
 */
export function PersonLayer({
  dynastyId,
  onBack,
  onPick,
}: {
  dynastyId: string;
  onBack: () => void;
  onPick: (p: PersonBrief) => void;
}) {
  const { persons, total, loading, error } = useDynastyPersons(dynastyId, 80);
  const { results, loading: sLoading, q, run } = usePersonSearch();
  const [searching, setSearching] = useState(false);

  const shown = searching && q.trim() ? results : persons;
  const name = DYNASTY_NAME[dynastyId] ?? dynastyId;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#03060f]">
      {/* 3D 星群 */}
      <div className="absolute inset-0">
        {loading ? (
          <div className="flex h-full items-center justify-center text-white/30">星群生成中…</div>
        ) : error ? (
          <div className="flex h-full items-center justify-center text-red-300/70">
            加载失败：{error}
          </div>
        ) : (
          <PersonStarScene persons={shown} onPick={onPick} />
        )}
      </div>

      {/* 顶部 */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 flex items-start justify-between px-8 py-6">
        <div className="pointer-events-auto">
          <button
            onClick={onBack}
            className="rounded-full border border-white/20 px-4 py-1.5 text-xs tracking-wider text-white/70 transition hover:bg-white/10"
          >
            ← 返回长河
          </button>
        </div>
        <div className="text-right">
          <div className="text-[13px] tracking-[0.3em] text-sky-300/70">代表人物</div>
          <h2 className="mt-1 text-5xl font-semibold tracking-tight text-white">{name}</h2>
          <div className="mt-1 text-xs text-white/45">
            {searching && q
              ? `${shown.length} 个搜索结果`
              : `收录 ${total.toLocaleString()} 人 · 展示前 ${persons.length}`}
          </div>
        </div>
      </div>

      {/* 底部搜索 */}
      <div className="absolute bottom-8 left-1/2 w-[min(560px,90vw)] -translate-x-1/2">
        <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 backdrop-blur-xl">
          <Search className="h-4 w-4 shrink-0 text-white/40" />
          <input
            value={q}
            onChange={(e) => {
              setSearching(true);
              run(e.target.value);
            }}
            placeholder="搜索人物（跨全部朝代）…"
            className="w-full bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
          />
          {searching && (
            <button
              onClick={() => {
                setSearching(false);
                run('');
              }}
              className="shrink-0 text-xs text-white/40 hover:text-white/70"
            >
              清除
            </button>
          )}
          {sLoading && <span className="shrink-0 text-xs text-white/30">…</span>}
        </div>
        <div className="mt-2 text-center text-xs text-white/30">星越大越亮 = 越重要 · 点击进入</div>
      </div>
    </div>
  );
}
