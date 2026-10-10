'use client';

import { useEffect, useState } from 'react';
import { api, type PersonBrief } from '@/lib/api';
import { Input } from './ui/input';

/**
 * 第二层：朝代内容（分类 + 搜索）
 * 目前先用简洁的卡片网格呈现「代表人物」；3D 星群后续替换。
 */

// polity 名称映射：dynasty id → 后端 polity 值
const POLITY: Record<string, string> = {
  'song-w': '两宋',
  'song-e': '南宋',
  liao: '辽',
  'jin-chao': '金',
  xixia: '西夏',
};

// 类别分组（按 role 字段粗分，后续从数据细化）

export function DynastyView({
  dynasty,
  onPick,
  onBack,
}: {
  dynasty: { id: string; name: string; start: number; end: number; note: string };
  onPick: (p: PersonBrief) => void;
  onBack: () => void;
}) {
  const [people, setPeople] = useState<PersonBrief[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(null);
    const polity = POLITY[dynasty.id];
    const req = q ? api.persons({ q, limit: 60 }) : api.persons({ polity, min_prom: 5, limit: 60 });
    req
      .then((r) => {
        if (!alive) return;
        setPeople(r.data);
        setTotal(r.total ?? r.data.length);
      })
      .catch((e) => alive && setErr(String(e.message || e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [dynasty.id, q]);

  return (
    <div className="relative z-10 flex h-full flex-col">
      {/* 顶栏 */}
      <header className="flex items-center justify-between px-8 py-6">
        <div>
          <button
            onClick={onBack}
            className="mb-2 text-xs tracking-widest text-lr-muted transition-colors hover:text-lr-accent"
          >
            ← 返回时间长河
          </button>
          <h2 className="text-glow text-3xl font-semibold tracking-[0.2em] text-lr-accent">
            {dynasty.name}
          </h2>
          <p className="mt-1 text-xs text-lr-muted">
            {dynasty.start < 0 ? `前${-dynasty.start}` : dynasty.start} – {dynasty.end} ｜{' '}
            {dynasty.note}
          </p>
        </div>
        <div className="w-72">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索人物（跨朝代）…"
          />
        </div>
      </header>

      {/* 内容 */}
      <div className="flex-1 overflow-y-auto px-8 pb-16">
        {err && <p className="text-lr-accent-2 text-sm">加载失败：{err}</p>}
        {loading && <p className="animate-pulse-glow text-sm text-lr-muted">载入中…</p>}

        {!loading && !err && (
          <>
            <p className="mb-4 text-xs tracking-widest text-lr-muted">
              {q ? `搜索「${q}」` : '代表人物'} · {total} 条
              {!q && total > people.length && `（显示前 ${people.length}）`}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {people.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onPick(p)}
                  className="gear-border group rounded-lg p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-glow"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="text-lg font-medium text-lr-fg transition-colors group-hover:text-lr-accent">
                      {p.name}
                    </span>
                    {p.prominence != null && (
                      <span className="text-[10px] text-lr-muted">P{p.prominence}</span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-lr-muted">
                    {p.birth || p.death ? `${p.birth ?? '?'}–${p.death ?? '?'}` : '生卒不详'}
                    {p.role && ` · ${p.role}`}
                  </div>
                  {p.summary && (
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-lr-muted">
                      {p.summary}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
