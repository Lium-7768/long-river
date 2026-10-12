'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fmtYear, fmtRange } from '@/components/river/year';

type Emperor = {
  qid: string;
  title: string;
  native: string;
  dynasty_id: string;
  reign_start: number | null;
  reign_end: number | null;
};

/** 帝王世系（来自 Wikidata P39=中国皇帝地位 + 正史本名补全）。 */
export function EmperorPanel({ dynastyId }: { dynastyId: string }) {
  const [rows, setRows] = useState<Emperor[]>([]);
  const [state, setState] = useState<'loading' | 'ok' | 'err'>('loading');

  useEffect(() => {
    let alive = true;
    setState('loading');
    api
      .emperors(dynastyId)
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

  if (state === 'err') return null;
  if (state === 'loading') return null;
  if (!rows.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {rows.map((e) => (
        <div
          key={e.qid}
          className="rounded-lg border border-amber-400/20 bg-amber-400/[0.05] px-4 py-3"
        >
          <div className="flex items-baseline gap-2">
            <span className="text-base font-medium text-amber-100/90">{e.title}</span>
            {e.native && e.native !== e.title && (
              <span className="text-base text-amber-200/50">{e.native}</span>
            )}
          </div>
          {(e.reign_start != null || e.reign_end != null) && (
            <div className="mt-1 text-base tabular-nums text-white/40">
              {e.reign_start != null && e.reign_end != null
                ? fmtRange(e.reign_start, e.reign_end)
                : e.reign_start != null
                  ? fmtYear(e.reign_start)
                  : '—'}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
