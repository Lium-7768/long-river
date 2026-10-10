'use client';

import { fmtYearShort } from '@/components/river/year';
import { Breadcrumb } from '@/components/profile/Breadcrumb';

export interface ItemDetailData {
  kind: 'event' | 'system' | 'culture';
  name: string;
  year?: number;
  desc: string;
  tag?: string;
}

const KIND = {
  event: { label: '重大事件', color: 'text-rose-300' },
  system: { label: '政治制度', color: 'text-amber-300' },
  culture: { label: '文化成就', color: 'text-emerald-300' },
} as const;

export function ItemDetail({
  data,
  dynastyId,
  dynastyName,
}: {
  data: ItemDetailData;
  dynastyId: string;
  dynastyName: string;
}) {
  const k = KIND[data.kind];
  return (
    <main className="min-h-screen bg-[#03060f] px-6 py-6 text-white">
      <div className="mx-auto max-w-3xl space-y-6">
        <Breadcrumb
          items={[
            { label: '长河', href: '/' },
            { label: dynastyName, href: `/dynasty/${dynastyId}` },
            { label: data.name },
          ]}
        />

        <header className="border-b border-white/10 pb-6">
          <div className={`text-base tracking-[0.3em] ${k.color}`}>{k.label}</div>
          <div className="mt-2 flex items-baseline gap-4">
            <h1 className="text-5xl font-semibold tracking-tight">{data.name}</h1>
            {data.year != null && (
              <span className="text-lg tabular-nums text-white/45">{fmtYearShort(data.year)}</span>
            )}
          </div>
          {data.tag && <div className="mt-2 text-base text-white/40">{data.tag}</div>}
        </header>

        <p className="text-base leading-relaxed text-white/80">{data.desc}</p>
      </div>
    </main>
  );
}
