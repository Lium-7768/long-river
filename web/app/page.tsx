'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { PersonLayer } from '@/components/persons/PersonLayer';
import type { Dynasty } from '@/content/dynasties';
import type { PersonBrief } from '@/lib/api';

const RiverExperience = dynamic(
  () => import('@/components/river/RiverExperience').then((m) => m.RiverExperience),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen w-screen items-center justify-center bg-[#03060f] text-white/40">
        载入…
      </div>
    ),
  },
);

/**
 * 三层下钻：
 *  L1 时间长河 → 点朝代 → L2 人物星群 → 点人物 → L3 关系图
 */
export default function Home() {
  const [layer, setLayer] = useState<
    { l1: true; dynasty?: undefined } | { l1?: undefined; dynasty: Dynasty }
  >({
    l1: true,
  });
  const [person, setPerson] = useState<PersonBrief | null>(null);

  if (!layer.l1 && layer.dynasty) {
    return (
      <PersonLayer
        dynastyId={layer.dynasty.id}
        onBack={() => setLayer({ l1: true })}
        onPick={(p) => setPerson(p)}
      />
    );
  }

  return (
    <>
      <RiverExperience onEnterDynasty={(d) => setLayer({ dynasty: d })} />
      {person && <div className="sr-only">{person.name}</div>}
    </>
  );
}
