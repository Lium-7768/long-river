import { notFound } from 'next/navigation';
import { DYNASTIES } from '@/content/dynasties';
import { getProfile } from '@/content/profiles';
import { ItemDetail } from '@/components/profile/ItemDetail';

export default async function Page({ params }: { params: Promise<{ id: string; slug: string }> }) {
  const { id, slug } = await params;
  const dynasty = DYNASTIES.find((d) => d.id === id);
  const profile = getProfile(id);
  const name = decodeURIComponent(slug);
  const s = profile?.institutions.find((x) => x.name === name);

  if (!dynasty || !s) notFound();

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
      dynastyName={dynasty.name}
    />
  );
}
