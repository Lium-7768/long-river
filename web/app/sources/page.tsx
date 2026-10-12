'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Breadcrumb } from '@/components/profile/Breadcrumb';

type Src = {
  book: string;
  category: string;
  n_claims: number;
  n_persons: number;
  claim_types: string;
  in_texts: number;
};
type Meta = { total: number; categories: { category: string; n: number; claims: number }[] };

const CLAIM_LABEL: Record<string, string> = {
  name: '姓名',
  addr: '籍贯',
  office: '官职',
  entry: '科第',
  kin: '亲属',
  assoc: '交游',
  status: '身份',
  bio: '传记',
};

export default function SourcesPage() {
  const [rows, setRows] = useState<Src[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [state, setState] = useState<'loading' | 'ok' | 'err'>('loading');

  useEffect(() => {
    let alive = true;
    setState('loading');
    api
      .evidenceSources({ category: cat || undefined, q: q || undefined, limit: 200 })
      .then((r) => {
        if (!alive) return;
        setRows(r.data);
        setMeta(r.meta);
        setState('ok');
      })
      .catch(() => alive && setState('err'));
    return () => {
      alive = false;
    };
  }, [cat, q]);

  return (
    <main className="relative z-10 min-h-screen bg-[#05070d] px-6 py-10 text-white [background-image:linear-gradient(rgba(40,52,78,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(40,52,78,0.5)_1px,transparent_1px)] [background-size:44px_44px]">
      <div className="mx-auto max-w-4xl space-y-6 rounded-2xl border border-white/10 bg-[#0d121e]/95 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
        <Breadcrumb items={[{ label: '长河', href: '/' }, { label: '史料来源' }]} />

        <header>
          <div className="text-base tracking-[0.3em] text-sky-300/70">可核验性</div>
          <h1 className="mt-2 text-6xl font-semibold tracking-tight">史料来源</h1>
          <p className="mt-4 text-base leading-relaxed text-white/70">
            长河每条人物数据均可回溯至具体史料。下表列出数据出处及其贡献的记录数。
          </p>
        </header>

        {meta && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCat('')}
              className={`rounded-full px-4 py-1 text-base transition ${
                !cat
                  ? 'bg-sky-400/90 text-black'
                  : 'border border-white/20 text-white/60 hover:text-white'
              }`}
            >
              全部 {meta.categories.reduce((s, c) => s + c.n, 0)}
            </button>
            {meta.categories.map((c) => (
              <button
                key={c.category}
                onClick={() => setCat(c.category)}
                className={`rounded-full px-4 py-1 text-base transition ${
                  cat === c.category
                    ? 'bg-sky-400/90 text-black'
                    : 'border border-white/20 text-white/60 hover:text-white'
                }`}
              >
                {c.category} {c.n}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索史料名…"
            className="w-full bg-transparent text-base text-white placeholder:text-white/30 focus:outline-none"
          />
        </div>

        {state === 'loading' && (
          <div className="py-12 text-center text-base text-white/40">加载中…</div>
        )}
        {state === 'err' && (
          <div className="py-12 text-center text-base text-white/40">加载失败</div>
        )}

        {state === 'ok' && (
          <div className="space-y-2">
            {rows.map((s) => (
              <div
                key={s.book}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-base font-medium text-white/85">{s.book}</span>
                  <span className="text-base tabular-nums text-sky-300/70">
                    {s.n_claims.toLocaleString()} 条记录 · {s.n_persons.toLocaleString()} 人
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded border border-white/10 bg-white/[0.03] px-2 py-0.5 text-base text-white/40">
                    {s.category}
                  </span>
                  {s.claim_types
                    .split(',')
                    .filter(Boolean)
                    .map((t) => (
                      <span
                        key={t}
                        className="rounded border border-sky-400/20 bg-sky-400/[0.06] px-2 py-0.5 text-base text-sky-200/70"
                      >
                        {CLAIM_LABEL[t] || t}
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
