'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

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
 *  L1 时间长河 → 点朝代 → /dynasty/[id] L2 档案 → 点格子 → L3 详情页
 */
export default function Home() {
  const router = useRouter();
  return (
    <RiverExperience
      onEnterDynasty={(d) => {
        router.push(`/dynasty/${d.id}`);
      }}
    />
  );
}
