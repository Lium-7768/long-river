import { notFound } from 'next/navigation';
import { DYNASTIES } from '@/content/dynasties';
import { getProfile, PROFILES } from '@/content/profiles';
import { ItemDetail } from '@/components/profile/ItemDetail';
import { itemSlug } from '@/content/profiles/slug';

export function generateStaticParams() {
  const out: { id: string; slug: string }[] = [];
  for (const [id, p] of Object.entries(PROFILES)) {
    for (const item of p.culture) out.push({ id, slug: item.name });
  }
  return out;
}

export const dynamicParams = false;

export default async function Page({ params }: { params: Promise<{ id: string; slug: string }> }) {
  const { id, slug } = await params;
  const dynasty = DYNASTIES.find((d) => d.id === id);
  const profile = getProfile(id);
  const name = decodeURIComponent(slug); // Next 已解码一次，兜底再解
  const c = profile?.culture.find((x) => x.name === name);

  if (!dynasty || !c) notFound();

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
      dynastyName={dynasty.name}
    />
  );
}
