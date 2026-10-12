import { notFound } from 'next/navigation';
import { fetchDynastyProfile, fetchAllItemParams } from '@/lib/dynasty-server';
import { ItemDetail } from '@/components/profile/ItemDetail';

/**
 * 第三层：制度详情。数据来自 /api/dynasty-profile。
 */
export async function generateStaticParams() {
  const all = await fetchAllItemParams();
  return all.systems;
}

export const dynamicParams = false;

export default async function Page({ params }: { params: Promise<{ id: string; slug: string }> }) {
  const { id, slug } = await params;
  const name = decodeURIComponent(slug);
  const profile = await fetchDynastyProfile(id);
  const s = profile?.institutions.find((x) => x.name === name);
  if (!profile || !s) notFound();

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
      dynastyName={profile.name}
    />
  );
}
