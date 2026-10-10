'use client';

import { fmtYear } from '@/components/river/year';
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
    <main className="relative z-10 min-h-screen bg-[#05070d] px-6 py-10 text-white [background-image:linear-gradient(rgba(40,52,78,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(40,52,78,0.5)_1px,transparent_1px)] [background-size:44px_44px]">
      <div className="mx-auto max-w-3xl space-y-6 rounded-2xl border border-white/10 bg-[#0d121e]/95 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
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
              <span className="text-lg tabular-nums text-white/45">{fmtYear(data.year)}</span>
            )}
          </div>
          {data.tag && <div className="mt-2 text-base text-white/40">{data.tag}</div>}
        </header>

        <p className="text-base leading-relaxed text-white/80">{data.desc}</p>
      </div>
    </main>
  );
}
