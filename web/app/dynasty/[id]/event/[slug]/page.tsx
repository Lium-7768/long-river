import { notFound } from 'next/navigation';
import { fetchDynastyProfile, fetchAllItemParams } from '@/lib/dynasty-server';
import { ItemDetail } from '@/components/profile/ItemDetail';

/**
 * 第三层：事件详情。数据来自 /api/dynasty-profile。
 */
export async function generateStaticParams() {
  const all = await fetchAllItemParams();
  return all.events;
}

export const dynamicParams = false;

export default async function Page({ params }: { params: Promise<{ id: string; slug: string }> }) {
  const { id, slug } = await params;
  const name = decodeURIComponent(slug);
  const profile = await fetchDynastyProfile(id);
  const e = profile?.events.find((x) => x.name === name);
  if (!profile || !e) notFound();

  return (
    <ItemDetail
      data={{
        kind: 'event',
        name: e.name,
        year: e.year,
        desc: e.desc,
        tag: e.category,
        background: e.background,
        outcome: e.outcome,
        impact: e.impact,
        figures: e.figures,
        source: e.source,
      }}
      dynastyId={id}
      dynastyName={profile.name}
    />
  );
}
