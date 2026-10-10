'use client';

import { useMemo } from 'react';
import { SONG_W } from '@/content/profiles/song-w';
import { fmtRangeBP, fmtYearShort } from '@/components/river/year';
import { useDynastyPersons } from '@/components/persons/use-persons';
import type { PersonBrief } from '@/lib/api';

const p = SONG_W;
const YEAR_A = 960;
const YEAR_B = 1127;

export default function Preview() {
  const { persons } = useDynastyPersons('song-w', 12);

  // 按生年排序的人物
  const people = useMemo(
    () =>
      persons
        .filter((x) => typeof x.birth === 'number')
        .sort((a, b) => (a.birth ?? 0) - (b.birth ?? 0)),
    [persons],
  );

  return (
    <main className="min-h-screen bg-[#03060f] px-6 py-6 text-white">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* 页头 */}
        <header>
          <div className="text-[13px] tracking-[0.3em] text-sky-300/70">朝代 · 预览</div>
          {/* 标题 + 年份 同行，其间留明显间隔 */}
          <div className="mt-3 flex items-baseline gap-4">
            <h1 className="text-6xl font-semibold tracking-tight">北宋</h1>
            <div className="text-lg tabular-nums text-white/45">{fmtRangeBP(YEAR_A, YEAR_B)}</div>
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/70">{p.overview}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {p.keywords.map((k) => (
              <span
                key={k}
                className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs text-sky-200"
              >
                {k}
              </span>
            ))}
          </div>
        </header>

        {/* ① 代表人物 */}
        <Block title="代表人物" sub="按生年排序 · 点击进入关系图">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-2">
            {people.map((per) => (
              <PersonCard key={per.id} person={per} />
            ))}
          </div>
        </Block>

        {/* ② 政治制度 */}
        <Block title="政治制度" sub="按确立年份排序">
          <Timeline
            nodes={p.institutions
              .filter((it) => it.year)
              .map((it) => ({ year: it.year!, name: it.name, desc: it.desc }))}
            color="amber"
          />
        </Block>

        {/* ③ 重大事件 */}
        <Block title="重大事件" sub="按年份排序">
          <Timeline
            nodes={p.events.map((e) => ({ year: e.year, name: e.name, desc: e.desc }))}
            color="rose"
          />
        </Block>

        {/* ④ 文化成就 */}
        <Block title="文化成就" sub="按出现年份排序">
          <Timeline
            nodes={p.culture
              .filter((c) => c.year)
              .map((c) => ({ year: c.year!, name: c.name, desc: c.desc, tag: c.category }))}
            color="emerald"
          />
        </Block>

        {/* ⑤ 疆域地理 */}
        <Block title="疆域地理">
          <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-5 text-sm">
            <KV label="都城" value={p.territory.capital} />
            <KV label="疆域" value={p.territory.extent} />
            {p.territory.note && <KV label="备注" value={p.territory.note} />}
          </div>
        </Block>
      </div>
    </main>
  );
}

const COLOR = {
  amber: { dot: 'bg-amber-400', line: 'bg-amber-400/20', tag: 'text-amber-300' },
  rose: { dot: 'bg-rose-400', line: 'bg-rose-400/20', tag: 'text-rose-300' },
  emerald: { dot: 'bg-emerald-400', line: 'bg-emerald-400/20', tag: 'text-emerald-300' },
  sky: { dot: 'bg-sky-400', line: 'bg-sky-400/20', tag: 'text-sky-300' },
} as const;

function Block({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 flex items-baseline gap-2 border-b border-white/10 pb-2">
        <h2 className="text-2xl font-semibold tracking-wide text-white/90">{title}</h2>
        {sub && <span className="text-xs text-white/35">{sub}</span>}
      </div>
      {children}
    </section>
  );
}

function Timeline({
  nodes,
  color,
}: {
  nodes: { year: number; name: string; desc: string; tag?: string }[];
  color: keyof typeof COLOR;
}) {
  const c = COLOR[color];
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2">
      {nodes.map((n, i) => (
        <div
          key={`${n.name}-${i}`}
          className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3"
        >
          <div className="flex items-baseline gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${c.dot}`} />
            <span className="text-sm tabular-nums text-white/45">{fmtYearShort(n.year)}</span>
            <span className="font-medium text-white/90">{n.name}</span>
            {n.tag && <span className={`text-xs ${c.tag}`}>{n.tag}</span>}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-white/50">{n.desc}</p>
        </div>
      ))}
    </div>
  );
}

function PersonCard({ person }: { person: PersonBrief }) {
  const life =
    person.birth && person.death
      ? `${fmtYearShort(person.birth)}–${fmtYearShort(person.death)}`
      : person.birth
        ? `${fmtYearShort(person.birth)}—`
        : '';

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 transition hover:border-sky-400/40 hover:bg-sky-400/[0.06]">
      {/* 第一行：名字（左） 官位（右） */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-medium text-white/90">{person.name}</span>
        {person.top_office && (
          <span className="shrink-0 text-xs text-sky-300/70">{person.top_office}</span>
        )}
      </div>
      {/* 第二行：字（左） 年（右） */}
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <span className="truncate text-xs text-white/40">{person.zi ? `字${person.zi}` : ''}</span>
        {life && <span className="shrink-0 text-xs tabular-nums text-white/35">{life}</span>}
      </div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4">
      <span className="w-16 shrink-0 text-white/40">{label}</span>
      <span className="text-white/75">{value}</span>
    </div>
  );
}
