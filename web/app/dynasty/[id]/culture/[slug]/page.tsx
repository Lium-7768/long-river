import { notFound } from 'next/navigation';
import { fetchDynastyProfile, fetchAllItemParams } from '@/lib/dynasty-server';
import { ItemDetail } from '@/components/profile/ItemDetail';

/**
 * 第三层：文化详情。数据来自 /api/dynasty-profile。
 */
export async function generateStaticParams() {
  const all = await fetchAllItemParams();
  return all.cultures;
}

export const dynamicParams = false;

export default async function Page({ params }: { params: Promise<{ id: string; slug: string }> }) {
  const { id, slug } = await params;
  const name = decodeURIComponent(slug);
  const profile = await fetchDynastyProfile(id);
  const c = profile?.culture.find((x) => x.name === name);
  if (!profile || !c) notFound();

  return (
    <ItemDetail
      data={{
        kind: 'culture',
        name: c.name,
        year: c.year,
        desc: c.desc,
        tag: c.category,
        background: c.background,
        impact: c.impact,
        figures: c.figures,
        works: c.works,
        source: c.source,
      }}
      dynastyId={id}
      dynastyName={profile.name}
    />
  );
}
