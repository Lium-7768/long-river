'use client';

import type { PersonBrief } from '@/lib/api';
import { fmtYear, fmtRange } from '@/components/river/year';

/**
 * 人物卡片（L2 代表人物块 / 朝代人物全量页共用）。
 * 整卡可点 → 人物详情（第三层）。
 */
export function PersonCard({ person, onClick }: { person: PersonBrief; onClick: () => void }) {
  const life =
    person.birth && person.death
      ? fmtRange(person.birth, person.death)
      : person.birth
        ? fmtYear(person.birth)
        : '';
  return (
    <button
      onClick={onClick}
      className="w-full cursor-pointer rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left transition hover:border-sky-400/40 hover:bg-sky-400/[0.07]"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className="min-w-0 flex-1 truncate text-base font-medium text-white/90"
          title={person.name}
        >
          {person.name}
        </span>
        {person.top_office && (
          <span
            className="max-w-[104px] shrink-0 truncate text-base text-sky-300/70"
            title={person.top_office}
          >
            {person.top_office}
          </span>
        )}
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <span className="truncate text-base text-white/40">
          {person.zi ? `字${person.zi}` : ''}
        </span>
        {life && (
          <span className="shrink-0 text-base tabular-nums text-white/35" title={life}>
            {life}
          </span>
        )}
      </div>
    </button>
  );
}
