import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DYNASTIES } from '@/content/dynasties';
import { getProfile } from '@/content/profiles';
import { DynastyProfileView } from '@/components/profile/DynastyProfileView';

export default async function DynastyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dynasty = DYNASTIES.find((d) => d.id === id);
  if (!dynasty) notFound();

  const profile = getProfile(id);
  if (!profile) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#03060f] px-6 text-white">
        <h1 className="text-5xl font-semibold">{dynasty.name}</h1>
        <p className="text-white/50">该朝代的档案还在整理中。</p>
        <Link
          href="/"
          className="rounded-full border border-white/15 px-4 py-1.5 text-xs text-white/60 transition hover:bg-white/10"
        >
          ← 返回长河
        </Link>
      </main>
    );
  }

  return <DynastyProfileView dynasty={dynasty} profile={profile} />;
}
