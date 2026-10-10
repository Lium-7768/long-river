'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, type PersonDetail } from '@/lib/api';
import { DYNASTIES } from '@/content/dynasties';
import { fmtRangeBP, fmtYearShort } from '@/components/river/year';
import { KinshipGraph } from '@/components/profile/KinshipGraph';
import { PersonDrawer } from '@/components/profile/PersonDrawer';

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
    <main className="min-h-screen bg-[#03060f] px-6 py-6 text-white">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link
          href={`/dynasty/${id}`}
          className="inline-block rounded-full border border-white/15 px-3 py-1 text-xs text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          ← 返回{dynasty?.name ?? '朝代'}
        </Link>

        {state === 'loading' && <div className="py-20 text-center text-white/40">加载中…</div>}
        {state === 'err' && <div className="py-20 text-center text-white/40">未找到该人物</div>}

        {state === 'ok' && p && (
          <>
            <header className="border-b border-white/10 pb-6">
              <div className="flex flex-wrap items-baseline gap-4">
                <h1 className="text-6xl font-semibold tracking-tight">{p.name}</h1>
                {p.top_office && <span className="text-lg text-sky-300/80">{p.top_office}</span>}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-white/50">
                {p.zi && <span>字{p.zi}</span>}
                {p.hao?.length ? <span>号{p.hao.join('、')}</span> : null}
                {p.shi?.length ? <span>谥{p.shi.join('、')}</span> : null}
                {(p.birth || p.death) && (
                  <span className="tabular-nums">{fmtRangeBP(p.birth ?? 0, p.death ?? 0)}</span>
                )}
                {p.addr?.length ? <span>{p.addr.join(' · ')}</span> : null}
              </div>
              {p.summary && (
                <p className="mt-5 max-w-3xl text-base leading-relaxed text-white/75">
                  {p.summary}
                </p>
              )}
            </header>

            {p.offices.length > 0 && (
              <Section title={`历任官职（${p.offices.length}）`}>
                <div className="flex flex-wrap gap-1.5">
                  {p.offices.map((o, i) => (
                    <span
                      key={i}
                      className="rounded bg-white/[0.05] px-2 py-0.5 text-xs text-white/65"
                    >
                      {o.office}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {p.kinships.length > 0 && (
              <Section title={`亲属关系（${p.kinships.length}）`}>
                <KinshipGraph
                  kinships={p.kinships}
                  onPick={(id, name) => setDrawer({ id, name })}
                />
              </Section>
            )}

            {p.entries.length > 0 && (
              <Section title="科第 / 条目">
                <div className="flex flex-wrap gap-2 text-xs text-white/60">
                  {p.entries.map((e, i) => (
                    <span key={i} className="rounded bg-white/[0.05] px-2 py-0.5 tabular-nums">
                      {e.year ? fmtYearShort(e.year) : '—'} {e.entry ?? ''}
                    </span>
                  ))}
                </div>
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
      <h2 className="mb-4 border-b border-white/10 pb-2 text-lg font-semibold text-white/80">
        {title}
      </h2>
      {children}
    </section>
  );
}
