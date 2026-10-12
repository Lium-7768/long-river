'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, type Poem } from '@/lib/api';
import { useDynastyName } from '@/lib/dynasty-data';
import { Breadcrumb } from '@/components/profile/Breadcrumb';

type PoemDetail = Poem & {
  siblings?: Poem[];
  person?: { id: string; dynasty_id: string | null } | null;
};

export default function PoemPage({ params }: { params: Promise<{ id: string; pid: string }> }) {
  const { id, pid } = use(params);
  const [poem, setPoem] = useState<PoemDetail | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'err'>('loading');
  const dynastyName = useDynastyName(id);

  useEffect(() => {
    api
      .poem(pid)
      .then((r) => {
        setPoem(r.data as PoemDetail);
        setState('ok');
      })
      .catch(() => setState('err'));
  }, [pid]);

  return (
    <main className="relative z-10 min-h-screen bg-[#05070d] px-6 py-10 text-white [background-image:linear-gradient(rgba(40,52,78,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(40,52,78,0.5)_1px,transparent_1px)] [background-size:44px_44px]">
      <div className="mx-auto max-w-3xl space-y-6 rounded-2xl border border-white/10 bg-[#0d121e]/95 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
        <Breadcrumb
          items={[
            { label: '长河', href: '/' },
            { label: dynastyName, href: `/dynasty/${id}` },
            { label: poem?.title ?? '诗词' },
          ]}
        />

        {state === 'loading' && (
          <div className="py-20 text-center text-base text-white/40">加载中…</div>
        )}
        {state === 'err' && (
          <div className="py-20 text-center text-base text-white/40">未找到该诗词</div>
        )}

        {state === 'ok' && poem && (
          <>
            <header className="border-b border-white/10 pb-6">
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{poem.title}</h1>
              <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-base text-white/50">
                <span className="text-sky-300/80">{poem.author}</span>
                {poem.genre && <span>{poem.genre}</span>}
                {poem.n_lines ? <span className="tabular-nums">{poem.n_lines} 句</span> : null}
              </div>
              {poem.person && (
                <Link
                  href={`/dynasty/${id}/person/${poem.person.id}`}
                  className="mt-3 inline-block text-base text-sky-400/70 underline-offset-4 hover:underline"
                >
                  → 查看作者 {poem.author} 的人物档案
                </Link>
              )}
            </header>

            <article className="whitespace-pre-line text-2xl leading-loose tracking-wide text-white/90">
              {poem.content}
            </article>

            {poem.siblings?.length ? (
              <section>
                <div className="mb-4 flex items-baseline gap-2 border-b border-white/10 pb-2">
                  <h2 className="text-2xl font-semibold tracking-wide text-white/90">
                    作者其他作品
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {poem.siblings.map((s) => (
                    <Link
                      key={s.id}
                      href={`/dynasty/${id}/poem/${s.id}`}
                      className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1 text-base text-white/70 transition hover:border-sky-400/40 hover:bg-sky-400/[0.07]"
                    >
                      {s.title}
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
