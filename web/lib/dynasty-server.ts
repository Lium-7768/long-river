/**
 * 朝代数据层（服务端 / 构建期）
 * ------------------------------------------------------------
 * 供 Server Component 与 generateStaticParams 使用。
 * 直接 fetch 后端 API（不经 'use client' 的 api.ts）。
 */
import type { DynastyProfileData, DynastyMeta } from './api';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8787';

async function getJson<T>(path: string, revalidate = 60): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { next: { revalidate } });
    if (!res.ok) return null;
    const json = await res.json();
    return json.ok ? (json.data as T) : null;
  } catch {
    return null;
  }
}

export async function fetchDynastyIds(): Promise<string[]> {
  const rows = await getJson<DynastyMeta[]>('/api/dynasties');
  return (rows ?? []).map((d) => d.id);
}

export async function fetchDynastyProfile(id: string): Promise<DynastyProfileData | null> {
  return getJson<DynastyProfileData>(`/api/dynasty-profile?dynasty=${encodeURIComponent(id)}`);
}

export async function fetchAllItemParams(): Promise<{
  events: { id: string; slug: string }[];
  systems: { id: string; slug: string }[];
  cultures: { id: string; slug: string }[];
}> {
  const ids = await fetchDynastyIds();
  const events: { id: string; slug: string }[] = [];
  const systems: { id: string; slug: string }[] = [];
  const cultures: { id: string; slug: string }[] = [];
  for (const id of ids) {
    const p = await fetchDynastyProfile(id);
    if (!p) continue;
    for (const e of p.events) events.push({ id, slug: e.name });
    for (const s of p.institutions) systems.push({ id, slug: s.name });
    for (const c of p.culture) cultures.push({ id, slug: c.name });
  }
  return { events, systems, cultures };
}

/** 构建期/服务端：取疆域示意覆盖 */
export async function fetchTerritoryCoverage(): Promise<
  Record<string, { provinces: string[]; note?: string }>
> {
  return (
    (await getJson<Record<string, { provinces: string[]; note?: string }>>(
      '/api/territory-coverage',
    )) ?? {}
  );
}

/** 服务端/构建期：取人物简要（校验存在 + 用于诗词作者名）*/
export async function fetchPersonBrief(
  id: string,
): Promise<{ id: string; name: string; nPoems?: number } | null> {
  return getJson<{ id: string; name: string; nPoems?: number }>(
    `/api/persons/${encodeURIComponent(id)}`,
  );
}
