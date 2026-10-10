'use client';

import { use, useEffect, useState } from 'react';
import { api, type PersonDetail } from '@/lib/api';
import { DYNASTIES } from '@/content/dynasties';
import { fmtRangeBP, fmtYearShort } from '@/components/river/year';
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
                  <span className="tabular-nums">{fmtRangeBP(p.birth ?? 0, p.death ?? 0)}</span>
                )}
                {p.addr?.length ? <span>{p.addr.join(' · ')}</span> : null}
              </div>
              {p.summary && (
                <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/75">
                  {p.summary}
                </p>
              )}
            </header>

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
                      {e.year ? fmtYearShort(e.year) : '—'} {e.entry ?? ''}
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
