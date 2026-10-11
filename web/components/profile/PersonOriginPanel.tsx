'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export interface OriginRow {
  name: string;
  lon: number;
  lat: number;
  n: number;
}

/**
 * 人物籍贯分布：展示该朝代人物籍贯 TOP（来自本地库 person_geo）。
 */
export function PersonOriginPanel({ dynastyId }: { dynastyId: string }) {
  const [rows, setRows] = useState<OriginRow[]>([]);
  const [state, setState] = useState<'loading' | 'ok' | 'empty'>('loading');

  useEffect(() => {
    let alive = true;
    api
      .personGeo(dynastyId)
      .then((r) => {
        if (!alive) return;
        const d = (r as { data?: OriginRow[] }).data ?? [];
        setRows(d);
        setState(d.length ? 'ok' : 'empty');
      })
      .catch(() => alive && setState('empty'));
    return () => {
      alive = false;
    };
  }, [dynastyId]);

  if (state === 'empty') return null;

  const max = rows[0]?.n ?? 1;

  return (
    <div>
      <h2 className="mb-3 border-b border-white/10 pb-2 text-base font-medium tracking-wider text-white/50">
        人物籍贯分布
      </h2>
      {state === 'loading' ? (
        <p className="text-base text-white/40">加载中…</p>
      ) : (
        <>
          <p className="mb-4 text-base leading-relaxed text-white/45">
            本朝人物籍贯前 {rows.length} 地（据 CBDB 籍贯 + CHGIS 坐标）。
          </p>
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.name} className="flex items-center gap-3 text-base">
                <span className="w-24 shrink-0 text-white/80">{r.name}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                  <div
                    className="h-full rounded-full bg-sky-400/40"
                    style={{ width: `${Math.max(4, (r.n / max) * 100)}%` }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right tabular-nums text-white/50">
                  {r.n} 人
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
