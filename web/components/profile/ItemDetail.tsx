'use client';

import Link from 'next/link';
import { fmtYear, fmtRange } from '@/components/river/year';
import { Breadcrumb } from '@/components/profile/Breadcrumb';

export interface ItemDetailData {
  kind: 'event' | 'system' | 'culture';
  name: string;
  year?: number;
  endYear?: number;
  desc: string;
  tag?: string;
  /** 制度/事件/文化共用 */
  background?: string;
  outcome?: string;
  impact?: string;
  figures?: { name: string; personId?: string }[];
  works?: string[];
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
  const span =
    data.year != null && data.endYear != null
      ? fmtRange(data.year, data.endYear)
      : data.year != null
        ? fmtYear(data.year)
        : '';

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
          <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 className="text-5xl font-semibold tracking-tight">{data.name}</h1>
            {span && <span className="text-lg tabular-nums text-white/45">{span}</span>}
            {data.tag && (
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-0.5 text-base text-white/60">
                {data.tag}
              </span>
            )}
          </div>
        </header>

        {/* 一句话简述 */}
        <p className="text-base leading-relaxed text-white/80">{data.desc}</p>

        {data.background && (
          <Section title="设立背景">
            <p className="text-base leading-relaxed text-white/70">{data.background}</p>
          </Section>
        )}

        {data.outcome && (
          <Section title="经过 / 结果">
            <p className="text-base leading-relaxed text-white/70">{data.outcome}</p>
          </Section>
        )}

        {data.impact && (
          <Section title="影响 / 后果">
            <p className="text-base leading-relaxed text-white/70">{data.impact}</p>
          </Section>
        )}

        {data.works && data.works.length > 0 && (
          <Section title="代表作品">
            <div className="flex flex-wrap gap-2">
              {data.works.map((w, i) => (
                <span
                  key={i}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1 text-base text-white/70"
                >
                  {w}
                </span>
              ))}
            </div>
          </Section>
        )}

        {data.figures && data.figures.length > 0 && (
          <Section title="关键人物">
            <div className="flex flex-wrap gap-2">
              {data.figures.map((f, i) =>
                f.personId ? (
                  <Link
                    key={i}
                    href={`/dynasty/${dynastyId}/person/${f.personId}`}
                    className="rounded-lg border border-sky-400/25 bg-sky-400/10 px-3 py-1 text-base text-sky-200 transition hover:border-sky-400/50 hover:bg-sky-400/20"
                  >
                    {f.name}
                  </Link>
                ) : (
                  <span
                    key={i}
                    className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1 text-base text-white/60"
                  >
                    {f.name}
                  </span>
                ),
              )}
            </div>
          </Section>
        )}
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 border-b border-white/10 pb-2 text-base font-medium tracking-wider text-white/50">
        {title}
      </h2>
      {children}
    </section>
  );
}
