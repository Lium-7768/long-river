import { notFound } from 'next/navigation';
import { DYNASTIES } from '@/content/dynasties';
import { getProfile } from '@/content/profiles';
import { ItemDetail } from '@/components/profile/ItemDetail';

export default async function Page({ params }: { params: Promise<{ id: string; slug: string }> }) {
  const { id, slug } = await params;
  const dynasty = DYNASTIES.find((d) => d.id === id);
  const profile = getProfile(id);
  const name = decodeURIComponent(slug);
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
