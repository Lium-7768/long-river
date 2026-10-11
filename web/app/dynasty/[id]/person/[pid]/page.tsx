'use client';

import { use, useEffect, useState } from 'react';
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
              </div>
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
                      title={w.category ? `类别：${w.category}` : undefined}
                    >
                      {w.title}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {p.kinships.length > 0 && (
              <Section title={`亲属关系（${p.kinships.length}）`}>
                <KinshipGraph3D
                  kinships={p.kinships}
                  onPick={(pid2, name) => setDrawer({ id: pid2, name })}
                />
              </Section>
            )}
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
