'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { fmtYear } from '@/components/river/year';
import { EmptyState, LoadingSkeleton } from './EmptyState';

type Nianhao = {
  id: number;
  dynasty: string;
  dynasty_id: string;
  name: string;
  start: number | null;
  end: number | null;
};

/** 年号表（CBDB nianhao，681 个）。展示该朝年号及起止公元纪年。 */
export function NianhaoPanel({ dynastyId }: { dynastyId: string }) {
  const [rows, setRows] = useState<Nianhao[]>([]);
  const [state, setState] = useState<'loading' | 'ok' | 'err'>('loading');
  const [q, setQ] = useState('');

  useEffect(() => {
    let alive = true;
    setState('loading');
    api
      .nianhao(dynastyId)
      .then((r) => {
        if (!alive) return;
        setRows(r.data);
        setState('ok');
      })
      .catch(() => alive && setState('err'));
    return () => {
      alive = false;
    };
  }, [dynastyId]);

  const shown = useMemo(() => (q ? rows.filter((n) => n.name.includes(q)) : rows), [rows, q]);

  if (state === 'loading') return <LoadingSkeleton lines={2} />;
  if (state === 'err')
    return <EmptyState title="年号暂不可用" desc="数据源暂时不可达，稍后重试。" icon="年" />;
  if (!rows.length) return <EmptyState title="暂无年号" desc="该朝代的年号数据还在整理中。" icon="年" />;

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索年号…"
          className="w-full bg-transparent text-base text-white placeholder:text-white/30 focus:outline-none"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {shown.map((n) => (
          <div
            key={n.id}
            className="rounded-lg border border-teal-400/20 bg-teal-400/[0.05] px-4 py-2"
          >
            <span className="text-base font-medium text-teal-100/90">{n.name}</span>
            {n.start != null && (
              <span className="ml-2 text-base text-white/40">
                {fmtYear(n.start)}
                {n.end != null && n.end !== n.start ? ` — ${fmtYear(n.end)}` : ''}
              </span>
            )}
          </div>
        ))}
        {!shown.length && <span className="text-base text-white/40">无匹配年号</span>}
      </div>
    </div>
  );
}
