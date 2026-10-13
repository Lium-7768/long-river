import { notFound } from 'next/navigation';
import { fetchDynastyProfile, fetchDynastyIds } from '@/lib/dynasty-server';
import { DynastyPersonsList } from '@/components/persons/DynastyPersonsList';

export async function generateStaticParams() {
  const ids = await fetchDynastyIds();
  return ids.map((id) => ({ id }));
}

export const dynamicParams = false;

/** 朝代人物 · 全量列表（服务端校验朝代存在，客户端分页拉取）。 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await fetchDynastyProfile(id);
  if (!profile) notFound();
  return <DynastyPersonsList id={id} dynastyName={profile.name} />;
}
