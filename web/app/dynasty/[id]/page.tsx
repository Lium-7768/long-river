import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchDynastyProfile, fetchDynastyIds } from '@/lib/dynasty-server';
import { DynastyProfileView } from '@/components/profile/DynastyProfileView';

/**
 * 第二层：朝代档案。
 * 数据全部来自后端 API（/api/dynasty-profile），不再是前端硬编码。
 */
export async function generateStaticParams() {
  const ids = await fetchDynastyIds();
  return ids.map((id) => ({ id }));
}

export const dynamicParams = false;

export default async function DynastyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await fetchDynastyProfile(id);
  if (!profile) notFound();

  const dynasty = {
    id: profile.id,
    name: profile.name,
    start: profile.start,
    end: profile.end,
    note: profile.note,
    colorVar: profile.colorVar,
  };

  // 有朝代但档案为空的情况
  if (!profile.overview && !profile.institutions?.length) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#03060f] px-6 text-white">
        <h1 className="text-5xl font-semibold">{dynasty.name}</h1>
        <p className="text-white/50">该朝代的档案还在整理中。</p>
        <Link
          href="/"
          className="rounded-full border border-white/15 px-4 py-1.5 text-base text-white/60 transition hover:bg-white/10"
        >
          ← 返回长河
        </Link>
      </main>
    );
  }

  return <DynastyProfileView dynasty={dynasty} profile={profile} />;
}
