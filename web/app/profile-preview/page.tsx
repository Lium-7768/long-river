'use client';

import { useMemo } from 'react';
import { SONG_W } from '@/content/profiles/song-w';
import { fmtYearShort } from '@/components/river/year';
import { useDynastyPersons } from '@/components/persons/use-persons';
import type { PersonBrief } from '@/lib/api';

const p = SONG_W;
const START = 960;
const END = 1127;

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
    <main className="min-h-screen bg-[#03060f] px-6 py-14 text-white">
      <div className="mx-auto max-w-4xl space-y-20">
        {/* 页头 */}
        <header>
          <div className="text-[13px] tracking-[0.3em] text-sky-300/70">朝代 · 预览</div>
          <h1 className="mt-2 text-6xl font-semibold tracking-tight">北宋</h1>
          <div className="mt-1 text-sm tabular-nums text-white/45">
            {fmtYearShort(START)} — {fmtYearShort(END)}
          </div>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/70">{p.overview}</p>
          <div className="mt-4 flex flex-wrap gap-2">
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
          <div className="grid gap-3 sm:grid-cols-2">
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
      <div className="mb-6 flex items-baseline gap-3 border-b border-white/10 pb-3">
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
    <div className="relative pl-24">
      <div className={`absolute bottom-2 left-[66px] top-2 w-px ${c.line}`} />
      {nodes.map((n, i) => (
        <div key={`${n.name}-${i}`} className="relative mb-6 flex items-start">
          <div className="absolute -left-24 w-14 pt-1 text-right text-sm tabular-nums text-white/55">
            {fmtYearShort(n.year)}
          </div>
          <div className="relative z-10 flex w-[24px] justify-center pt-1.5">
            <span className={`h-3 w-3 rounded-full ${c.dot} ring-4 ring-[#03060f]`} />
          </div>
          <div className="flex-1 pl-4">
            <div className="flex items-baseline gap-2">
              <span className="font-medium text-white/90">{n.name}</span>
              {n.tag && <span className={`text-xs ${c.tag}`}>{n.tag}</span>}
            </div>
            <div className="mt-0.5 text-sm text-white/50">{n.desc}</div>
          </div>
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
    <div className="group rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-sky-400/40 hover:bg-sky-400/[0.06]">
      <div className="flex items-baseline justify-between">
        <span className="text-lg font-medium text-white/90">{person.name}</span>
        <span className="text-xs tabular-nums text-white/40">{life}</span>
      </div>
      {person.role && <div className="mt-1 text-xs text-sky-300/60">{person.role}</div>}
      {person.summary && (
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-white/50">{person.summary}</p>
      )}
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
