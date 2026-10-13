'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, type Poem } from '@/lib/api';
import { Breadcrumb } from '@/components/profile/Breadcrumb';

const PAGE = 50;

/**
 * 人物 · 全部诗词（分页 + 搜索 + 体裁筛选）。
 * 数据全部来自 /api/poems?author=，不隐藏任何作品。
 */
export function PersonPoemsList({
  dynastyId,
  dynastyName,
  personId,
  personName,
  fallbackTotal,
}: {
  dynastyId: string;
  dynastyName: string;
  personId: string;
  personName: string;
  fallbackTotal?: number;
}) {
  const router = useRouter();
  const [poems, setPoems] = useState<Poem[]>([]);
  const [total, setTotal] = useState(fallbackTotal ?? 0);
  const [offset, setOffset] = useState(0);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [genre, setGenre] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setOffset(0);
  }, [debouncedQ, genre]);

  const seq = useRef(0);
  const load = useCallback(async () => {
    const my = ++seq.current;
    setLoading(true);
    setErr(null);
    try {
      const r = await api.poems({
        author: personName,
        q: debouncedQ || undefined,
        genre: genre || undefined,
        limit: PAGE,
        offset,
      });
      if (my !== seq.current) return;
      setTotal(r.total ?? r.data.length);
      setPoems((prev) => (offset === 0 ? r.data : [...prev, ...r.data]));
    } catch (e) {
      if (my !== seq.current) return;
      setErr(String((e as Error)?.message || e));
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [personName, debouncedQ, genre, offset]);

  useEffect(() => {
    load();
  }, [load]);

  const hasMore = poems.length < total;

  return (
    <main className="relative z-10 min-h-screen bg-[#05070d] px-6 py-10 text-white [background-image:linear-gradient(rgba(40,52,78,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(40,52,78,0.5)_1px,transparent_1px)] [background-size:44px_44px]">
      <div className="mx-auto max-w-5xl space-y-6 rounded-2xl border border-white/10 bg-[#0d121e]/95 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
        <Breadcrumb
          items={[
            { label: '长河', href: '/' },
            { label: dynastyName, href: `/dynasty/${dynastyId}` },
            { label: personName, href: `/dynasty/${dynastyId}/person/${personId}` },
            { label: '诗词' },
          ]}
        />

        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-base tracking-[0.3em] text-emerald-300/70">诗词作品</div>
            <h1 className="mt-2 text-5xl font-semibold tracking-tight">{personName} · 诗词</h1>
          </div>
          <div className="text-base text-white/40">
            共 <span className="tabular-nums text-white/70">{total.toLocaleString('en-US')}</span>{' '}
            首
            {total > 0 && (
              <span className="ml-2">· 已显示 {poems.length.toLocaleString('en-US')}</span>
            )}
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索标题 / 正文…"
            className="min-w-[200px] flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-base text-white placeholder:text-white/30 focus:border-emerald-400/50 focus:outline-none"
          />
          <div className="flex flex-wrap gap-1.5">
            {[
              { key: '', label: '全部' },
              { key: '诗', label: '诗' },
              { key: '词', label: '词' },
              { key: '曲', label: '曲' },
            ].map((g) => (
              <button
                key={g.key}
                onClick={() => setGenre(g.key)}
                className={
                  'rounded-lg border px-3 py-2 text-base transition ' +
                  (genre === g.key
                    ? 'border-emerald-400/50 bg-emerald-400/15 text-emerald-100'
                    : 'border-white/15 bg-white/5 text-white/60 hover:bg-white/10')
                }
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {err ? (
          <div className="rounded-xl border border-rose-400/20 bg-rose-400/5 p-6 text-center text-base text-rose-200/80">
            加载失败：{err}
          </div>
        ) : poems.length === 0 && loading ? (
          <div className="py-16 text-center text-base text-white/40">载入中…</div>
        ) : poems.length === 0 ? (
          <div className="py-16 text-center text-base text-white/40">
            {debouncedQ ? `没有匹配「${debouncedQ}」的作品` : '暂无可显示的作品'}
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {poems.map((po) => (
                <button
                  key={po.id}
                  onClick={() => router.push(`/dynasty/${dynastyId}/poem/${po.id}`)}
                  className="block w-full cursor-pointer rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:border-emerald-400/40 hover:bg-emerald-400/[0.06]"
                >
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <span className="text-base font-medium text-white/85">{po.title}</span>
                    {po.genre && <span className="text-base text-white/40">{po.genre}</span>}
                    {po.n_lines ? (
                      <span className="text-base text-white/30">{po.n_lines} 句</span>
                    ) : null}
                  </div>
                  {po.excerpt && (
                    <p className="mt-2 whitespace-pre-line text-base leading-relaxed text-white/65">
                      {po.excerpt}
                    </p>
                  )}
                </button>
              ))}
            </div>
            <div className="flex justify-center pt-2">
              {hasMore ? (
                <button
                  onClick={() => setOffset((o) => o + PAGE)}
                  disabled={loading}
                  className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-6 py-2.5 text-base text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-50"
                >
                  {loading
                    ? '载入中…'
                    : `加载更多（还有 ${(total - poems.length).toLocaleString('en-US')} 首）`}
                </button>
              ) : (
                <span className="text-base text-white/30">
                  — 已显示全部 {poems.length.toLocaleString('en-US')} 首 —
                </span>
              )}
            </div>
          </>
        )}

        <div className="pt-2">
          <Link
            href={`/dynasty/${dynastyId}/person/${personId}`}
            className="text-base text-sky-300/70 transition hover:text-sky-200"
          >
            ← 返回{personName}
          </Link>
        </div>
      </div>
    </main>
  );
}
