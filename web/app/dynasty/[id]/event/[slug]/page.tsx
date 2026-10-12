import { notFound } from 'next/navigation';
import { DYNASTIES } from '@/content/dynasties';
import { getProfile } from '@/content/profiles';
import { ItemDetail } from '@/components/profile/ItemDetail';

export default async function Page({ params }: { params: Promise<{ id: string; slug: string }> }) {
  const { id, slug } = await params;
  const dynasty = DYNASTIES.find((d) => d.id === id);
  const profile = getProfile(id);
  const name = decodeURIComponent(slug);
  const e = profile?.events.find((x) => x.name === name);

  if (!dynasty || !e) notFound();

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
      dynastyName={dynasty.name}
    />
  );
}
