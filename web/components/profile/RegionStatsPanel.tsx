'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface RegionRow {
  region: string;
  kaiyuan_hu: number;
  yuanhe_hu: number;
}

/**
 * 政区户数（唐·元和郡县图志）：展示开元/元和户口对比。
 */
export function RegionStatsPanel({ dynastyId }: { dynastyId: string }) {
  const [rows, setRows] = useState<RegionRow[]>([]);

  useEffect(() => {
    if (dynastyId !== 'tang') return;
    let alive = true;
    api
      .regionStats()
      .then((r) => {
        if (alive) setRows(((r as { data?: RegionRow[] }).data ?? []).slice(0, 20));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [dynastyId]);

  if (dynastyId !== 'tang' || rows.length === 0) return null;

  return (
    <div>
      <h2 className="mb-3 border-b border-white/10 pb-2 text-base font-medium tracking-wider text-white/50">
        政区户数（唐·元和郡县图志）
      </h2>
      <p className="mb-4 text-base leading-relaxed text-white/45">
        开元、元和两朝户口对比（据唐李吉甫《元和郡县图志》）。
      </p>
      <div className="space-y-2">
        {rows.map((r) => {
          const drop = r.kaiyuan_hu > 0 && r.yuanhe_hu > 0;
          const ratio = drop ? Math.round((1 - r.yuanhe_hu / r.kaiyuan_hu) * 100) : 0;
          return (
            <div key={r.region} className="flex items-center gap-3 text-base">
              <span className="w-24 shrink-0 text-white/80">{r.region}</span>
              <span className="w-32 shrink-0 tabular-nums text-white/60">
                开元 {r.kaiyuan_hu.toLocaleString()}
              </span>
              <span className="w-32 shrink-0 tabular-nums text-white/60">
                元和 {r.yuanhe_hu.toLocaleString()}
              </span>
              {ratio > 0 ? <span className="text-white/40">减 {ratio}%</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
