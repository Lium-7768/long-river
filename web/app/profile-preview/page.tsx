'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { SONG_W } from '@/content/profiles/song-w';
import { fmtRangeBP, fmtYearShort } from '@/components/river/year';
import { useDynastyPersons, usePersonSearch } from '@/components/persons/use-persons';
import { DetailDrawer, type DetailPayload } from '@/components/profile/DetailDrawer';
import { Territory } from '@/components/profile/Territory';
import type { PersonBrief } from '@/lib/api';

const p = SONG_W;
const YEAR_A = 960;
const YEAR_B = 1127;

export default function Preview() {
  const { persons } = useDynastyPersons('song-w', 24);
  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const { results, run, q } = usePersonSearch();

  const searching = q.trim().length > 0;
  const list = searching ? results.filter((x) => typeof x.birth === 'number' || x.name) : persons;
  const people = useMemo(
    () => [...list].sort((a, b) => (a.birth ?? 9999) - (b.birth ?? 9999)),
    [list],
  );

  return (
    <main className="min-h-screen bg-[#03060f] px-6 py-6 text-white">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* 页头 */}
        <header>
          <div className="text-[13px] tracking-[0.3em] text-sky-300/70">朝代 · 预览</div>
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

        {/* ① 代表人物 + 搜索 */}
        <Block
          title="代表人物"
          sub={searching ? `${people.length} 个结果` : '按生年排序 · 点击查看详情'}
          action={
            <div className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5">
              <Search className="h-3.5 w-3.5 text-white/40" />
              <input
                value={q}
                onChange={(e) => run(e.target.value)}
                placeholder="搜索人物…"
                className="w-40 bg-transparent text-xs text-white placeholder:text-white/30 focus:outline-none"
              />
            </div>
          }
        >
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
            {people.map((per) => (
              <PersonCard
                key={per.id}
                person={per}
                onClick={() => setDetail({ kind: 'person', id: per.id, name: per.name })}
              />
            ))}
          </div>
        </Block>

        {/* ② 政治制度 */}
        <Block title="政治制度" sub="按确立年份排序 · 点击查看详情">
          <CardGrid>
            {p.institutions.map((it) => (
              <Card
                key={it.name}
                year={it.year}
                name={it.name}
                desc={it.desc}
                color="amber"
                onClick={() =>
                  setDetail({ kind: 'institution', year: it.year, name: it.name, desc: it.desc })
                }
              />
            ))}
          </CardGrid>
        </Block>

        {/* ③ 重大事件 */}
        <Block title="重大事件" sub="按年份排序 · 点击查看详情">
          <CardGrid>
            {p.events.map((e) => (
              <Card
                key={e.name}
                year={e.year}
                name={e.name}
                desc={e.desc}
                color="rose"
                onClick={() =>
                  setDetail({ kind: 'event', year: e.year, name: e.name, desc: e.desc })
                }
              />
            ))}
          </CardGrid>
        </Block>

        {/* ④ 文化成就 */}
        <Block title="文化成就" sub="按出现年份排序 · 点击查看详情">
          <CardGrid>
            {p.culture.map((c) => (
              <Card
                key={c.name}
                year={c.year}
                name={c.name}
                desc={c.desc}
                tag={c.category}
                color="emerald"
                onClick={() =>
                  setDetail({
                    kind: 'culture',
                    year: c.year,
                    name: c.name,
                    desc: c.desc,
                    tag: c.category,
                  })
                }
              />
            ))}
          </CardGrid>
        </Block>

        {/* ⑤ 疆域地理 */}
        <Block title="疆域地理">
          <Territory
            id={p.id}
            capital={p.territory.capital}
            extent={p.territory.extent}
            note={p.territory.note}
          />
        </Block>
      </div>

      <DetailDrawer payload={detail} onClose={() => setDetail(null)} />
    </main>
  );
}

const COLOR = {
  amber: {
    dot: 'bg-amber-400',
    tag: 'text-amber-300',
    hover: 'hover:border-amber-400/40 hover:bg-amber-400/[0.07]',
  },
  rose: {
    dot: 'bg-rose-400',
    tag: 'text-rose-300',
    hover: 'hover:border-rose-400/40 hover:bg-rose-400/[0.07]',
  },
  emerald: {
    dot: 'bg-emerald-400',
    tag: 'text-emerald-300',
    hover: 'hover:border-emerald-400/40 hover:bg-emerald-400/[0.07]',
  },
} as const;

function Block({
  title,
  sub,
  action,
  children,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
        <div className="flex items-baseline gap-2">
          <h2 className="text-2xl font-semibold tracking-wide text-white/90">{title}</h2>
          {sub && <span className="text-xs text-white/35">{sub}</span>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function CardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2">{children}</div>
  );
}

function Card({
  year,
  name,
  desc,
  tag,
  color,
  onClick,
}: {
  year?: number;
  name: string;
  desc: string;
  tag?: string;
  color: keyof typeof COLOR;
  onClick: () => void;
}) {
  const c = COLOR[color];
  return (
    <button
      onClick={onClick}
      className={`cursor-pointer rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition ${c.hover}`}
    >
      <div className="flex items-baseline gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${c.dot}`} />
        {year != null && (
          <span className="text-sm tabular-nums text-white/45">{fmtYearShort(year)}</span>
        )}
        <span className="font-medium text-white/90">{name}</span>
        {tag && <span className={`text-xs ${c.tag}`}>{tag}</span>}
      </div>
      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/50">{desc}</p>
    </button>
  );
}

function PersonCard({ person, onClick }: { person: PersonBrief; onClick: () => void }) {
  const life =
    person.birth && person.death
      ? `${fmtYearShort(person.birth)}–${fmtYearShort(person.death)}`
      : person.birth
        ? `${fmtYearShort(person.birth)}—`
        : '';
  return (
    <button
      onClick={onClick}
      className="cursor-pointer rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left transition hover:border-sky-400/40 hover:bg-sky-400/[0.07]"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-medium text-white/90">{person.name}</span>
        {person.top_office && (
          <span className="shrink-0 truncate text-xs text-sky-300/70">{person.top_office}</span>
        )}
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <span className="truncate text-xs text-white/40">{person.zi ? `字${person.zi}` : ''}</span>
        {life && <span className="shrink-0 text-xs tabular-nums text-white/35">{life}</span>}
      </div>
    </button>
  );
}
