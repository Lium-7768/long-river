'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, type PersonBrief } from '@/lib/api';
import { PersonCard } from '@/components/persons/PersonCard';
import { Breadcrumb } from '@/components/profile/Breadcrumb';

type Sort = 'fame' | 'birth' | 'birth_desc' | 'name';

const SORTS: { key: Sort; label: string }[] = [
  { key: 'fame', label: '声望' },
  { key: 'birth', label: '生年早→晚' },
  { key: 'birth_desc', label: '生年晚→早' },
  { key: 'name', label: '姓名' },
];

const PAGE = 60;

/**
 * 朝代人物 · 全量列表（L2「查看全部」入口）。
 * 数据全部来自 /api/persons（分页 + 排序 + 搜索），不隐藏任何人物。
 */
export function DynastyPersonsList({ id, dynastyName }: { id: string; dynastyName: string }) {
  const router = useRouter();

  const [persons, setPersons] = useState<PersonBrief[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [sort, setSort] = useState<Sort>('fame');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // 搜索防抖
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  // 过滤条件变化 → 回到第一页
  useEffect(() => {
    setOffset(0);
  }, [sort, debouncedQ]);

  // 拉数据
  const seq = useRef(0);
  const load = useCallback(async () => {
    const my = ++seq.current;
    setLoading(true);
    setErr(null);
    try {
      const r = await api.persons({
        dynasty: id,
        sort,
        q: debouncedQ || undefined,
        limit: PAGE,
        offset,
      });
      if (my !== seq.current) return;
      setTotal(r.total ?? r.data.length);
      setPersons((prev) => (offset === 0 ? r.data : [...prev, ...r.data]));
    } catch (e) {
      if (my !== seq.current) return;
      setErr(String((e as Error)?.message || e));
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [id, sort, debouncedQ, offset]);

  useEffect(() => {
    load();
  }, [load]);

  const hasMore = persons.length < total;
  const shown = useMemo(() => persons.length, [persons]);

  return (
    <main className="relative z-10 min-h-screen bg-[#05070d] px-6 py-10 text-white [background-image:linear-gradient(rgba(40,52,78,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(40,52,78,0.5)_1px,transparent_1px)] [background-size:44px_44px]">
      <div className="mx-auto max-w-5xl space-y-6 rounded-2xl border border-white/10 bg-[#0d121e]/95 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
        <Breadcrumb
          items={[
            { label: '长河', href: '/' },
            { label: dynastyName, href: `/dynasty/${id}` },
            { label: '人物' },
          ]}
        />

        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-base tracking-[0.3em] text-sky-300/70">人物名录</div>
            <h1 className="mt-2 text-5xl font-semibold tracking-tight">{dynastyName} · 人物</h1>
          </div>
          <div className="text-base text-white/40">
            共 <span className="tabular-nums text-white/70">{total.toLocaleString('en-US')}</span>{' '}
            人{total > 0 && <span className="ml-2">· 已显示 {shown.toLocaleString('en-US')}</span>}
          </div>
        </header>

        {/* 工具栏：搜索 + 排序 */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索姓名 / 字…"
            className="min-w-[200px] flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-base text-white placeholder:text-white/30 focus:border-sky-400/50 focus:outline-none"
          />
          <div className="flex flex-wrap gap-1.5">
            {SORTS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSort(s.key)}
                className={
                  'rounded-lg border px-3 py-2 text-base transition ' +
                  (sort === s.key
                    ? 'border-sky-400/50 bg-sky-400/15 text-sky-100'
                    : 'border-white/15 bg-white/5 text-white/60 hover:bg-white/10')
                }
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* 列表 */}
        {err ? (
          <div className="rounded-xl border border-rose-400/20 bg-rose-400/5 p-6 text-center text-base text-rose-200/80">
            加载失败：{err}
          </div>
        ) : persons.length === 0 && loading ? (
          <div className="py-16 text-center text-base text-white/40">载入中…</div>
        ) : persons.length === 0 ? (
          <div className="py-16 text-center text-base text-white/40">
            {debouncedQ ? `没有匹配「${debouncedQ}」的人物` : '该朝代暂无人物数据'}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
              {persons.map((p) => (
                <PersonCard
                  key={p.id}
                  person={p}
                  onClick={() => router.push(`/dynasty/${id}/person/${p.id}`)}
                />
              ))}
            </div>
            <div className="flex justify-center pt-2">
              {hasMore ? (
                <button
                  onClick={() => setOffset((o) => o + PAGE)}
                  disabled={loading}
                  className="rounded-lg border border-sky-400/30 bg-sky-400/10 px-6 py-2.5 text-base text-sky-200 transition hover:bg-sky-400/20 disabled:opacity-50"
                >
                  {loading
                    ? '载入中…'
                    : `加载更多（还有 ${(total - shown).toLocaleString('en-US')} 人）`}
                </button>
              ) : (
                <span className="text-base text-white/30">
                  — 已显示全部 {shown.toLocaleString('en-US')} 人 —
                </span>
              )}
            </div>
          </>
        )}

        <div className="pt-2">
          <Link
            href={`/dynasty/${id}`}
            className="text-base text-sky-300/70 transition hover:text-sky-200"
          >
            ← 返回{dynastyName}档案
          </Link>
        </div>
      </div>
    </main>
  );
}
