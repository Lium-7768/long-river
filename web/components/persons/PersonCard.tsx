'use client';

import { motion } from 'framer-motion';
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
  const seal = person.name.slice(0, 1);
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 380, damping: 22 }}
      className="glass-subtle group relative w-full cursor-pointer overflow-hidden rounded-lg px-3 py-2.5 text-left"
    >
      <span className="ink-sprinkle" aria-hidden />
      <div className="relative flex items-center gap-2.5">
        <span className="seal-mark seal-mark--sm shrink-0 rounded-[4px]" aria-hidden>
          {seal}
        </span>
        <span className="min-w-0 flex-1 truncate text-base font-medium text-white/90" title={person.name}>
          {person.name}
        </span>
        {person.top_office && (
          <span className="max-w-[104px] shrink-0 truncate text-base text-white/45" title={person.top_office}>
            {person.top_office}
          </span>
        )}
      </div>
      <div className="relative mt-1.5 flex items-baseline justify-between gap-2">
        <span className="truncate text-base text-white/40">{person.zi ? `字${person.zi}` : ''}</span>
        {life && (
          <span className="shrink-0 text-base tabular-nums text-white/35" title={life}>
            {life}
          </span>
        )}
      </div>
    </motion.button>
  );
}
