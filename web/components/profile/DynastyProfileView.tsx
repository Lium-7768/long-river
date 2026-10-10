'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import type { DynastyProfile } from '@/content/profiles/types';
import { fmtRangeBP, fmtYearShort } from '@/components/river/year';
import { useDynastyPersons, usePersonSearch } from '@/components/persons/use-persons';
import { getCoverage } from '@/content/territory/coverage';
import { itemSlug } from '@/content/profiles/slug';
import { Breadcrumb } from '@/components/profile/Breadcrumb';
import type { PersonBrief } from '@/lib/api';
import type { Dynasty } from '@/content/dynasties';

/**
 * 第二层：朝代档案（分块）。
 * 人物 / 制度 / 事件 / 文化 / 疆域 各一块。点格子 → 第三层独立页。
 */
export function DynastyProfileView({
  dynasty,
  profile,
}: {
  dynasty: Dynasty;
  profile: DynastyProfile;
}) {
  const router = useRouter();
  const { persons } = useDynastyPersons(dynasty.id, 24);
  const { results, run, q } = usePersonSearch();
  const cov = getCoverage(dynasty.id);

  const searching = q.trim().length > 0;
  const base = searching ? results : persons;
  const people = useMemo(
    () => [...base].sort((a, b) => (a.birth ?? 9999) - (b.birth ?? 9999)),
    [base],
  );

  const goPerson = (p: PersonBrief) => router.push(`/dynasty/${dynasty.id}/person/${p.id}`);
  const goItem = (kind: 'event' | 'system' | 'culture', name: string) =>
    router.push(`/dynasty/${dynasty.id}/${kind}/${itemSlug(name)}`);

  return (
    <main className="relative z-10 min-h-screen px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl space-y-6 rounded-2xl border border-white/10 bg-[rgb(var(--lr-surface))] p-6 sm:p-8">
        <Breadcrumb items={[{ label: '长河', href: '/' }, { label: dynasty.name }]} />

        {/* 页头 */}
        <header>
          <div className="text-base tracking-[0.3em] text-sky-300/70">朝代档案</div>
          <div className="mt-2 flex items-baseline gap-4">
            <h1 className="text-6xl font-semibold tracking-tight">{dynasty.name}</h1>
            <div className="text-lg tabular-nums text-white/45">
              {fmtRangeBP(dynasty.start, dynasty.end)}
            </div>
          </div>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/70">
            {profile.overview}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {profile.keywords.map((k) => (
              <span
                key={k}
                className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-base text-sky-200"
              >
                {k}
              </span>
            ))}
          </div>
        </header>

        {/* ① 代表人物 */}
        <Block
          title="代表人物"
          sub={searching ? `${people.length} 个结果` : '按生年排序 · 点击进入'}
          action={
            <div className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5">
              <Search className="h-3.5 w-3.5 text-white/40" />
              <input
                value={q}
                onChange={(e) => run(e.target.value)}
                placeholder="搜索人物…"
                className="w-40 bg-transparent text-base text-white placeholder:text-white/30 focus:outline-none"
              />
            </div>
          }
        >
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
            {people.map((per) => (
              <PersonCard key={per.id} person={per} onClick={() => goPerson(per)} />
            ))}
          </div>
        </Block>

        {/* ② 政治制度 */}
        <Block title="政治制度" sub="按确立年份排序 · 点击进入">
          <CardGrid>
            {profile.institutions.map((it) => (
              <Card
                key={it.name}
                year={it.year}
                name={it.name}
                desc={it.desc}
                color="amber"
                onClick={() => goItem('system', it.name)}
              />
            ))}
          </CardGrid>
        </Block>

        {/* ③ 重大事件 */}
        <Block title="重大事件" sub="按年份排序 · 点击进入">
          <CardGrid>
            {profile.events.map((e) => (
              <Card
                key={e.name}
                year={e.year}
                name={e.name}
                desc={e.desc}
                color="rose"
                onClick={() => goItem('event', e.name)}
              />
            ))}
          </CardGrid>
        </Block>

        {/* ④ 文化成就 */}
        <Block title="文化成就" sub="按出现年份排序 · 点击进入">
          <CardGrid>
            {profile.culture.map((c) => (
              <Card
                key={c.name}
                year={c.year}
                name={c.name}
                desc={c.desc}
                tag={c.category}
                color="emerald"
                onClick={() => goItem('culture', c.name)}
              />
            ))}
          </CardGrid>
        </Block>

        {/* ⑤ 疆域地理 —— 与上面一样只是个格子，点进独立页 */}
        <Block title="疆域地理">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2">
            <button
              onClick={() => router.push(`/dynasty/${dynasty.id}/territory`)}
              className="cursor-pointer rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:border-cyan-400/40 hover:bg-cyan-400/[0.07]"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-base font-medium text-white/90">{dynasty.name}疆域</span>
                {cov && (
                  <span className="text-base text-cyan-300/70">
                    {cov.provinces.length} 省（示意）
                  </span>
                )}
              </div>
              <p className="mt-1 line-clamp-2 text-base leading-relaxed text-white/50">
                都城 {profile.territory.capital}
              </p>
            </button>
          </div>
        </Block>
      </div>
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
          {sub && <span className="text-base text-white/35">{sub}</span>}
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
          <span className="text-base tabular-nums text-white/45">{fmtYearShort(year)}</span>
        )}
        <span className="font-medium text-white/90">{name}</span>
        {tag && <span className={`text-base ${c.tag}`}>{tag}</span>}
      </div>
      <p className="mt-1 line-clamp-2 text-base leading-relaxed text-white/50">{desc}</p>
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
        <span className="truncate text-base font-medium text-white/90">{person.name}</span>
        {person.top_office && (
          <span className="shrink-0 truncate text-base text-sky-300/70">{person.top_office}</span>
        )}
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <span className="truncate text-base text-white/40">
          {person.zi ? `字${person.zi}` : ''}
        </span>
        {life && <span className="shrink-0 text-base tabular-nums text-white/35">{life}</span>}
      </div>
    </button>
  );
}
