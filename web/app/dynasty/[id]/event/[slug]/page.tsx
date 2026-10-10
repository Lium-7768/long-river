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
  const e = profile?.events.find((x) => x.name === name);

  if (!dynasty || !e) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#03060f] text-white/50">
        未找到「{name}」
      </div>
    );
  }
  return (
    <ItemDetail
      data={{ kind: 'event', name: e.name, year: e.year, desc: e.desc }}
      dynastyId={id}
      dynastyName={dynasty.name}
    />
  );
}
