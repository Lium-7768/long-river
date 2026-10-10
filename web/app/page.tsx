'use client';

import dynamic from 'next/dynamic';

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

export default function Home() {
  return <RiverExperience />;
}
