import { notFound } from 'next/navigation';
import { fetchDynastyProfile, fetchPersonBrief } from '@/lib/dynasty-server';
import { PersonPoemsList } from '@/components/persons/PersonPoemsList';

/**
 * 人物 · 全部诗词（服务端校验朝代+人物存在，客户端分页拉取）。
 * 路由: /dynasty/[id]/person/[pid]/poems
 */
export default async function Page({ params }: { params: Promise<{ id: string; pid: string }> }) {
  const { id, pid } = await params;
  const profile = await fetchDynastyProfile(id);
  if (!profile) notFound();

  // 校验人物存在（并取姓名作为 /api/poems?author= 的键）
  const person = await fetchPersonBrief(pid);
  if (!person?.name) notFound();
  const personName = person.name;

  return (
    <PersonPoemsList
      dynastyId={id}
      dynastyName={profile.name}
      personId={pid}
      personName={personName}
      fallbackTotal={person.nPoems}
    />
  );
}
