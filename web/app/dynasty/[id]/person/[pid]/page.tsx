'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, type PersonDetail } from '@/lib/api';
import { DYNASTIES } from '@/content/dynasties';
import { fmtRange, fmtYear } from '@/components/river/year';
import { KinshipGraph3D } from '@/components/profile/KinshipGraph3D';
import { PersonDrawer } from '@/components/profile/PersonDrawer';
import { Breadcrumb } from '@/components/profile/Breadcrumb';

export default function PersonPage({ params }: { params: Promise<{ id: string; pid: string }> }) {
  const { id, pid } = use(params);
  const [p, setP] = useState<PersonDetail | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'err'>('loading');
  const [drawer, setDrawer] = useState<{ id: string; name: string } | null>(null);
  const dynasty = DYNASTIES.find((d) => d.id === id);

  useEffect(() => {
    api
      .person(pid)
      .then((r) => {
        setP(r.data);
        setState('ok');
      })
      .catch(() => setState('err'));
  }, [pid]);

  return (
    <main className="relative z-10 min-h-screen bg-[#05070d] px-6 py-10 text-white [background-image:linear-gradient(rgba(40,52,78,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(40,52,78,0.5)_1px,transparent_1px)] [background-size:44px_44px]">
      <div className="mx-auto max-w-4xl space-y-6 rounded-2xl border border-white/10 bg-[#0d121e]/95 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
        <Breadcrumb
          items={[
            { label: '长河', href: '/' },
            { label: dynasty?.name ?? '朝代', href: `/dynasty/${id}` },
            { label: p?.name ?? '人物' },
          ]}
        />

        {state === 'loading' && (
          <div className="py-20 text-center text-base text-white/40">加载中…</div>
        )}
        {state === 'err' && (
          <div className="py-20 text-center text-base text-white/40">未找到该人物</div>
        )}

        {state === 'ok' && p && (
          <>
            <header className="border-b border-white/10 pb-6">
              <div className="flex flex-wrap items-baseline gap-4">
                <h1 className="text-6xl font-semibold tracking-tight">{p.name}</h1>
                {p.top_office && <span className="text-lg text-sky-300/80">{p.top_office}</span>}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-base text-white/50">
                {p.zi && <span>字{p.zi}</span>}
                {p.hao?.length ? <span>号{p.hao.join('、')}</span> : null}
                {p.shi?.length ? <span>谥{p.shi.join('、')}</span> : null}
                {(p.birth || p.death) && (
                  <span className="tabular-nums">
                    {fmtRange(p.birth ?? 0, p.death ?? 0)}
                    {p.birth_evid && <EvidTag label={p.birth_evid} />}
                  </span>
                )}
                {p.addr?.length ? <span>{p.addr.join(' · ')}</span> : null}
                {p.birthplaces?.length ? <span>籍贯 {p.birthplaces.join('、')}</span> : null}
                {p.ethnicity && p.ethnicity !== '汉' ? <span>民族 {p.ethnicity}</span> : null}
                {p.household ? <span>{p.household}</span> : null}
                {p.death_age ? <span>享年 {p.death_age}</span> : null}
                {p.network && p.network.n_out + p.network.n_in > 0 ? (
                  <span>
                    社会关系 {p.network.n_out + p.network.n_in} 条（{p.network.n_types} 类）
                  </span>
                ) : null}
              </div>
              {p.occupations?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {p.occupations.map((o, i) => (
                    <span
                      key={i}
                      className="rounded-lg border border-amber-400/20 bg-amber-400/[0.06] px-3 py-1 text-base text-amber-100/80"
                    >
                      {o}
                    </span>
                  ))}
                </div>
              ) : null}
              {p.statuses?.length ? (
                <div className="mt-3">
                  <div className="mb-2 text-base text-white/40">身份 / 技能</div>
                  <div className="flex flex-wrap gap-2">
                    {p.statuses.map((s, i) => (
                      <span
                        key={i}
                        className="rounded-lg border border-sky-400/20 bg-sky-400/[0.06] px-3 py-1 text-base text-sky-100/80"
                      >
                        {s.status}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {p.summary && (
                <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/75">
                  {p.summary}
                </p>
              )}
            </header>

            {p.sources?.length ? (
              <Section title="史料来源">
                <div className="flex flex-wrap gap-2">
                  {p.sources.map((s, i) => (
                    <span
                      key={i}
                      className="rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-1 text-base text-emerald-100/80"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </Section>
            ) : null}

            {p.aliases?.length ? (
              <Section title={`别名 / 字·号·行第·谥（${p.aliases.length}）`}>
                <div className="flex flex-wrap gap-2">
                  {p.aliases.map((a, i) => (
                    <span
                      key={i}
                      className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1 text-base text-white/75"
                    >
                      {a.alias}
                      <span className="ml-2 text-white/40">{a.type_desc}</span>
                    </span>
                  ))}
                </div>
              </Section>
            ) : null}

            {p.excerpts?.length ? (
              <Section title="正史原文">
                {p.excerpts.map((e, i) => (
                  <blockquote
                    key={i}
                    className="mb-3 rounded-lg border-l-2 border-amber-400/40 bg-amber-400/[0.04] px-4 py-3 text-base leading-relaxed text-white/75"
                  >
                    <div className="mb-2 text-base text-amber-200/70">
                      《{e.book}》{e.volume}
                    </div>
                    {e.excerpt.replace(/^==.*?==\s*/, '')}
                  </blockquote>
                ))}
              </Section>
            ) : null}

            {p.evid?.length ? (
              <Section title={`逐条证据（${p.evid.length}）`}>
                <p className="mb-4 text-base leading-relaxed text-white/45">
                  以下每条数据均指向具体史料出处，可逐条核验。
                </p>
                <ul className="space-y-2">
                  {p.evid.slice(0, 40).map((e, i) => (
                    <li
                      key={i}
                      className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-base"
                    >
                      <span className="shrink-0 rounded border border-sky-400/20 bg-sky-400/[0.08] px-2 py-0.5 text-base text-sky-100/80">
                        {CLAIM_LABEL[e.claim_type] ?? e.claim_type}
                      </span>
                      <span className="text-white/75">{e.src_book}</span>
                      {e.src_pages && (
                        <span className="tabular-nums text-white/40">{e.src_pages}</span>
                      )}
                    </li>
                  ))}
                </ul>
                {p.evid.length > 40 && (
                  <p className="mt-3 text-base text-white/40">
                    仅显示前 40 条，共 {p.evid.length} 条。
                  </p>
                )}
              </Section>
            ) : null}

            {p.offices.length > 0 && (
              <Section title={`历任官职（${p.offices.length}）`}>
                <div className="flex flex-wrap gap-2">
                  {p.offices.map((o, i) => (
                    <span
                      key={i}
                      className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1 text-base text-white/70"
                    >
                      {o.office}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {p.entries.length > 0 && (
              <Section title="科第 / 条目">
                <div className="flex flex-wrap gap-2">
                  {p.entries.map((e, i) => (
                    <span
                      key={i}
                      className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1 text-base tabular-nums text-white/70"
                    >
                      {e.year ? fmtYear(e.year) : '—'} {e.entry ?? ''}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {p.works.length > 0 && (
              <Section title={`著作（${p.works.length}）`}>
                <div className="flex flex-wrap gap-2">
                  {p.works.map((w, i) => (
                    <span
                      key={i}
                      className="rounded-lg border border-amber-400/20 bg-amber-400/[0.06] px-3 py-1 text-base text-amber-100/80"
                      title={
                        [w.category && `分类：${w.category}`, w.role && `角色：${w.role}`]
                          .filter(Boolean)
                          .join(' · ') || undefined
                      }
                    >
                      {w.title}
                      {w.category ? (
                        <span className="ml-2 text-amber-300/50">{w.category}</span>
                      ) : null}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {p.texts?.length ? (
              <Section title={`书目著录（${p.texts.length}）`}>
                <div className="flex flex-wrap gap-2">
                  {p.texts.map((t, i) => (
                    <span
                      key={i}
                      className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1 text-base text-white/70"
                      title={[t.role && `角色：${t.role}`, t.year > 0 && `公元${t.year}`]
                        .filter(Boolean)
                        .join(' · ')}
                    >
                      {t.title}
                      {t.role && t.role !== '未详' ? (
                        <span className="ml-2 text-white/40">{t.role}</span>
                      ) : null}
                    </span>
                  ))}
                </div>
              </Section>
            ) : null}

            {p.nPoems ? (
              <Section title={`诗词作品（${p.nPoems}）`}>
                <div className="space-y-3">
                  {(p.poems ?? []).slice(0, 20).map((po) => (
                    <Link
                      key={po.id}
                      href={`/dynasty/${id}/poem/${po.id}`}
                      className="block rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:border-emerald-400/40 hover:bg-emerald-400/[0.06]"
                    >
                      <div className="flex flex-wrap items-baseline gap-x-3">
                        <span className="text-base font-medium text-white/85">{po.title}</span>
                        <span className="text-base text-white/40">{po.genre}</span>
                      </div>
                      <p className="mt-2 whitespace-pre-line text-base leading-relaxed text-white/65">
                        {po.excerpt}
                      </p>
                    </Link>
                  ))}
                </div>
                {p.nPoems > 20 && (
                  <p className="mt-3 text-base text-white/40">仅显示前 20 首，共 {p.nPoems} 首。</p>
                )}
              </Section>
            ) : null}

            {p.institutions?.length ? (
              <Section title="书院 / 机构">
                <div className="flex flex-wrap gap-2">
                  {p.institutions.map((it, i) => (
                    <span
                      key={i}
                      className="rounded-lg border border-cyan-400/20 bg-cyan-400/[0.06] px-3 py-1 text-base text-cyan-100/80"
                      title={it.source ?? undefined}
                    >
                      {it.name}
                    </span>
                  ))}
                </div>
              </Section>
            ) : null}

            {p.possessions?.length ? (
              <Section title="家境 / 财产">
                <ul className="space-y-2">
                  {p.possessions.map((po, i) => (
                    <li
                      key={i}
                      className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-base text-white/75"
                    >
                      {po.desc}
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}

            {p.kinships.length > 0 && (
              <Section title={`亲属关系（${p.kinships.length}）`}>
                <KinshipGraph3D
                  kinships={p.kinships}
                  onPick={(pid2, name) => setDrawer({ id: pid2, name })}
                />
              </Section>
            )}

            {p.assocs?.length ? (
              <Section title={`社会关系（${p.assocs.length}）`}>
                <div className="flex flex-wrap gap-2">
                  {p.assocs.map((a, i) => (
                    <button
                      key={`${a.id}-${i}`}
                      onClick={() => setDrawer({ id: a.id, name: a.name })}
                      className="cursor-pointer rounded-lg border border-violet-400/20 bg-violet-400/[0.06] px-3 py-1 text-base text-violet-100/80 transition hover:border-violet-400/50 hover:bg-violet-400/[0.12]"
                      title={a.rel_name || undefined}
                    >
                      {a.rel_name ? (
                        <span className="text-violet-300/60">{a.rel_name}·</span>
                      ) : null}
                      {a.name}
                    </button>
                  ))}
                </div>
              </Section>
            ) : null}

            {p.masters?.length ? (
              <Section title={`师承（${p.masters.length}）`}>
                <div className="flex flex-wrap gap-2">
                  {p.masters.map((m, i) => (
                    <button
                      key={`${m.id}-${i}`}
                      onClick={() => setDrawer({ id: m.id, name: m.name })}
                      className="cursor-pointer rounded-lg border border-indigo-400/20 bg-indigo-400/[0.06] px-3 py-1 text-base text-indigo-100/80 transition hover:border-indigo-400/50 hover:bg-indigo-400/[0.12]"
                      title={m.rel || undefined}
                    >
                      {m.rel ? <span className="text-indigo-300/60">{m.rel}·</span> : null}
                      {m.name}
                    </button>
                  ))}
                </div>
              </Section>
            ) : null}

            {p.disciples?.length ? (
              <Section title={`门人（${p.disciples.length}）`}>
                <div className="flex flex-wrap gap-2">
                  {p.disciples.map((d, i) => (
                    <button
                      key={`${d.id}-${i}`}
                      onClick={() => setDrawer({ id: d.id, name: d.name })}
                      className="cursor-pointer rounded-lg border border-cyan-400/20 bg-cyan-400/[0.06] px-3 py-1 text-base text-cyan-100/80 transition hover:border-cyan-400/50 hover:bg-cyan-400/[0.12]"
                      title={d.rel || undefined}
                    >
                      {d.rel ? <span className="text-cyan-300/60">{d.rel}·</span> : null}
                      {d.name}
                    </button>
                  ))}
                </div>
              </Section>
            ) : null}
          </>
        )}
      </div>
      <PersonDrawer person={drawer} onClose={() => setDrawer(null)} />
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-4 flex items-baseline gap-2 border-b border-white/10 pb-2">
        <h2 className="text-2xl font-semibold tracking-wide text-white/90">{title}</h2>
      </div>
      {children}
    </section>
  );
}

const CLAIM_LABEL: Record<string, string> = {
  bio: '传记',
  summary: '事迹',
  name: '姓名/字号',
  addr: '籍贯',
  office: '官职',
  entry: '科举',
  kin: '亲属',
  assoc: '社会关系',
  status: '身份',
};

function EvidTag({ label }: { label: string }) {
  return (
    <span className="ml-2 rounded border border-emerald-400/20 bg-emerald-400/[0.06] px-2 py-0.5 text-base text-emerald-100/70">
      据{label}
    </span>
  );
}
