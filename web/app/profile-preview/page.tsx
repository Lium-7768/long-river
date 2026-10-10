'use client';

import { useMemo, useState } from 'react';
import { SONG_W } from '@/content/profiles/song-w';
import { fmtYearShort } from '@/components/river/year';
import { useDynastyPersons } from '@/components/persons/use-persons';

const p = SONG_W;
const START = 960;
const END = 1127;

type Kind = 'event' | 'institution' | 'culture' | 'person';

interface Node {
  year: number;
  kind: Kind;
  name: string;
  desc: string;
  tag?: string;
}

const KIND_META: Record<Kind, { label: string; color: string; dot: string }> = {
  event: { label: '事件', color: 'text-rose-300', dot: 'bg-rose-400' },
  institution: { label: '制度', color: 'text-amber-300', dot: 'bg-amber-400' },
  culture: { label: '文化', color: 'text-emerald-300', dot: 'bg-emerald-400' },
  person: { label: '人物', color: 'text-sky-300', dot: 'bg-sky-400' },
};

export default function Preview() {
  const [active, setActive] = useState<Set<Kind>>(
    new Set<Kind>(['event', 'institution', 'culture', 'person']),
  );
  const { persons } = useDynastyPersons('song-w', 15);

  // 汇总所有节点
  const nodes = useMemo<Node[]>(() => {
    const out: Node[] = [];
    for (const e of p.events) out.push({ year: e.year, kind: 'event', name: e.name, desc: e.desc });
    for (const it of p.institutions)
      if (it.year) out.push({ year: it.year, kind: 'institution', name: it.name, desc: it.desc });
    for (const c of p.culture)
      if (c.year)
        out.push({ year: c.year, kind: 'culture', name: c.name, desc: c.desc, tag: c.category });
    // 人物：用生年（无则跳过）
    for (const per of persons) {
      const y = per.birth;
      if (typeof y === 'number' && y >= START - 20 && y <= END)
        out.push({
          year: y,
          kind: 'person',
          name: per.name,
          desc: (per.summary || per.role || '').slice(0, 60),
        });
    }
    return out.sort((a, b) => a.year - b.year);
  }, [persons]);

  const shown = nodes.filter((n) => active.has(n.kind));

  const toggle = (k: Kind) => {
    const s = new Set(active);
    if (s.has(k)) s.delete(k);
    else s.add(k);
    setActive(s);
  };

  return (
    <main className="min-h-screen bg-[#03060f] px-6 py-14 text-white">
      <div className="mx-auto max-w-4xl">
        {/* 头部 */}
        <div className="text-[13px] tracking-[0.3em] text-sky-300/70">朝代时间线 · 预览</div>
        <h1 className="mt-2 text-6xl font-semibold tracking-tight">北宋</h1>
        <div className="mt-1 text-sm text-white/45">
          {fmtYearShort(START)} — {fmtYearShort(END)}
        </div>
        <p className="mt-4 text-lg leading-relaxed text-white/70">{p.overview}</p>

        {/* 图例 / 过滤 */}
        <div className="mt-6 flex flex-wrap gap-2">
          {(Object.keys(KIND_META) as Kind[]).map((k) => {
            const m = KIND_META[k];
            const on = active.has(k);
            return (
              <button
                key={k}
                onClick={() => toggle(k)}
                className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition ${
                  on ? 'border-white/25 bg-white/10' : 'border-white/10 opacity-40'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${m.dot}`} />
                {m.label}
              </button>
            );
          })}
        </div>

        {/* 统一时间轴 */}
        <div className="relative mt-12 pl-24">
          {/* 竖轴 */}
          <div className="absolute bottom-4 left-[70px] top-2 w-px bg-gradient-to-b from-sky-400/50 via-white/20 to-rose-400/50" />
          {shown.map((n, i) => {
            const m = KIND_META[n.kind];
            return (
              <div key={`${n.kind}-${n.name}-${i}`} className="relative mb-7 flex items-start">
                {/* 年份 */}
                <div className="absolute -left-24 w-16 pt-0.5 text-right text-sm tabular-nums text-white/55">
                  {fmtYearShort(n.year)}
                </div>
                {/* 轴上的点 */}
                <div className="relative z-10 mt-1.5 flex w-[28px] justify-center">
                  <span className={`h-3 w-3 rounded-full ${m.dot} ring-4 ring-[#03060f]`} />
                </div>
                {/* 内容 */}
                <div className="flex-1 pl-4">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] tracking-wider ${m.color} bg-white/5`}
                    >
                      {m.label}
                    </span>
                    <span className="font-medium text-white/90">{n.name}</span>
                    {n.tag && <span className="text-xs text-white/35">{n.tag}</span>}
                  </div>
                  <div className="mt-0.5 text-sm text-white/50">{n.desc}</div>
                </div>
              </div>
            );
          })}
          {/* 终点 */}
          <div className="relative flex items-center">
            <div className="absolute -left-24 w-16 pt-0.5 text-right text-sm tabular-nums text-white/55">
              {fmtYearShort(END)}
            </div>
            <div className="w-[28px]" />
            <div className="pl-4 text-sm text-rose-300/70">北宋亡（靖康之变）</div>
          </div>
        </div>

        {/* 制度 / 文化 无年份的补充展示 */}
        <section className="mt-16">
          <h2 className="mb-4 text-lg font-semibold text-white/80">政治制度</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {p.institutions.map((it) => (
              <div key={it.name} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="text-sm font-medium text-white/90">{it.name}</div>
                <div className="mt-1 text-xs text-white/50">{it.desc}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="mb-4 text-lg font-semibold text-white/80">疆域地理</h2>
          <div className="space-y-2 text-sm">
            <div className="flex gap-4">
              <span className="w-16 shrink-0 text-white/40">都城</span>
              <span className="text-white/75">{p.territory.capital}</span>
            </div>
            <div className="flex gap-4">
              <span className="w-16 shrink-0 text-white/40">疆域</span>
              <span className="text-white/75">{p.territory.extent}</span>
            </div>
            {p.territory.note && (
              <div className="flex gap-4">
                <span className="w-16 shrink-0 text-white/40">备注</span>
                <span className="text-white/75">{p.territory.note}</span>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
