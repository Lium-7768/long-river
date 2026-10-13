'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

interface Assoc {
  rel_name?: string | null;
  id: string;
  name: string;
}

const INITIAL = 60;
const STEP = 200;

/**
 * 社会关系块：先显示前 N 条，可「展开全部」分批加载（不隐藏任何关系）。
 * 支持按关系类型筛选。
 */
export function AssocBlock({
  personId,
  onPick,
  initialAssocs,
  totalCount,
}: {
  personId: string;
  onPick: (id: string, name: string) => void;
  initialAssocs: Assoc[];
  totalCount: number;
}) {
  const [items, setItems] = useState<Assoc[]>(initialAssocs);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rel, setRel] = useState('');
  const [rels, setRels] = useState<{ rel_name: string; n: number }[]>([]);
  const seq = useRef(0);

  // 首次展开时，拉全量（分页）
  const loadAll = useCallback(async () => {
    const my = ++seq.current;
    setLoading(true);
    try {
      const first = await api.personAssocs({ person: personId, limit: STEP, offset: 0 });
      if (my !== seq.current) return;
      setItems(first.data);
      setRels(first.rels ?? []);
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [personId]);

  // 按关系类型筛选（服务端过滤）
  useEffect(() => {
    if (!rel) return;
    let alive = true;
    setLoading(true);
    api
      .personAssocs({ person: personId, rel, limit: STEP, offset: 0 })
      .then((r) => {
        if (alive) setItems(r.data);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [rel, personId]);

  const hasMore = expanded && items.length < totalCount;

  return (
    <div>
      {/* 关系类型筛选 */}
      {expanded && rels.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          <button
            onClick={() => setRel('')}
            className={
              'rounded-lg border px-2.5 py-1 text-base transition ' +
              (rel === ''
                ? 'border-violet-400/50 bg-violet-400/15 text-violet-100'
                : 'border-white/15 bg-white/5 text-white/60 hover:bg-white/10')
            }
          >
            全部 {totalCount}
          </button>
          {rels.map((r) => (
            <button
              key={r.rel_name}
              onClick={() => setRel(r.rel_name)}
              className={
                'rounded-lg border px-2.5 py-1 text-base transition ' +
                (rel === r.rel_name
                  ? 'border-violet-400/50 bg-violet-400/15 text-violet-100'
                  : 'border-white/15 bg-white/5 text-white/60 hover:bg-white/10')
              }
            >
              {r.rel_name} {r.n}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {items.map((a, i) => (
          <button
            key={`${a.id}-${i}`}
            onClick={() => onPick(a.id, a.name)}
            className="cursor-pointer rounded-lg border border-violet-400/20 bg-violet-400/[0.06] px-3 py-1 text-base text-violet-100/80 transition hover:border-violet-400/50 hover:bg-violet-400/[0.12]"
            title={a.rel_name || undefined}
          >
            {a.rel_name ? <span className="text-violet-300/60">{a.rel_name}·</span> : null}
            {a.name}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {!expanded && totalCount > INITIAL && (
          <button
            onClick={() => {
              setExpanded(true);
              loadAll();
            }}
            className="rounded-lg border border-violet-400/30 bg-violet-400/10 px-3 py-1.5 text-base text-violet-200 transition hover:bg-violet-400/20"
          >
            展开全部 {totalCount} 条 →
          </button>
        )}
        {expanded && (
          <>
            <span className="text-base text-white/40">
              已显示 {items.length.toLocaleString('en-US')} / {totalCount.toLocaleString('en-US')}{' '}
              条
            </span>
            {hasMore && (
              <button
                onClick={async () => {
                  setLoading(true);
                  try {
                    const r = await api.personAssocs({
                      person: personId,
                      rel: rel || undefined,
                      limit: STEP,
                      offset: items.length,
                    });
                    setItems((prev) => [...prev, ...r.data]);
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="rounded-lg border border-violet-400/30 bg-violet-400/10 px-3 py-1.5 text-base text-violet-200 transition hover:bg-violet-400/20 disabled:opacity-50"
              >
                {loading ? '载入中…' : '加载更多'}
              </button>
            )}
            <button
              onClick={() => {
                setExpanded(false);
                setRel('');
                setItems(initialAssocs);
              }}
              className="text-base text-white/40 transition hover:text-white/70"
            >
              收起
            </button>
          </>
        )}
      </div>
    </div>
  );
}
