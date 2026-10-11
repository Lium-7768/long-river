'use client';

import { use } from 'react';
import { DYNASTIES } from '@/content/dynasties';
import { getProfile } from '@/content/profiles';
import { ItemDetail } from '@/components/profile/ItemDetail';

export default function Page({ params }: { params: Promise<{ id: string; slug: string }> }) {
  const { id, slug } = use(params);
  const dynasty = DYNASTIES.find((d) => d.id === id);
  const profile = getProfile(id);
  const name = decodeURIComponent(slug);
  const s = profile?.institutions.find((x) => x.name === name);

  if (!dynasty || !s) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#03060f] text-white/50">
        未找到「{name}」
      </div>
    );
  }
  return (
    <ItemDetail
      data={{
        kind: 'system',
        name: s.name,
        year: s.year,
        endYear: s.endYear,
        desc: s.desc,
        tag: s.category,
        background: s.background,
        impact: s.impact,
        figures: s.figures,
        source: s.source,
      }}
      dynastyId={id}
      dynastyName={dynasty.name}
    />
  );
}
