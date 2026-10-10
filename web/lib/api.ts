/**
 * API 客户端
 * ------------------------------------------------------------
 * 数据源可切换：本地 SQLite 后端 或 Cloudflare Worker。
 * 通过 NEXT_PUBLIC_API_BASE 环境变量指定；默认本地。
 *
 *   NEXT_PUBLIC_API_BASE=http://localhost:8787        本地 SQLite
 *   NEXT_PUBLIC_API_BASE=https://long-river-api.xxx   线上 D1
 */

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8787';

async function get<T>(
  path: string,
  params?: Record<string, string | number | undefined>,
): Promise<T> {
  const url = new URL(path, API_BASE);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`API ${res.status}: ${url.pathname}`);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'API error');
  return json as T;
}

export interface PersonBrief {
  id: string;
  name: string;
  surname?: string;
  birth?: number | null;
  death?: number | null;
  polity?: string | null;
  dynasty_id?: string | null;
  fame_score?: number | null;
  zi?: string | null;
  role?: string | null;
  prominence?: number | null;
  summary?: string | null;
}

export interface Kinship {
  rel: string;
  id: string;
  name: string;
}
export interface Office {
  office: string;
  year: number | null;
}
export interface Entry {
  entry: string;
  year: number | null;
}
export interface Work {
  title: string;
  category: string | null;
}

export interface PersonDetail extends PersonBrief {
  hao: string[];
  shi: string[];
  addr: string[];
  kinships: Kinship[];
  offices: Office[];
  entries: Entry[];
  works: Work[];
}

export interface Paged<T> {
  ok: true;
  data: T[];
  total?: number;
  limit?: number;
  offset?: number;
}

export const api = {
  stats: () => get<{ ok: true; data: Record<string, number | string> }>('/api/stats'),
  polities: () => get<{ ok: true; data: { polity: string; n: number }[] }>('/api/polities'),
  persons: (
    p: {
      q?: string;
      polity?: string;
      dynasty?: string;
      min_prom?: number;
      limit?: number;
      offset?: number;
    } = {},
  ) => get<Paged<PersonBrief>>('/api/persons', p),
  person: (id: string) =>
    get<{ ok: true; data: PersonDetail }>(`/api/persons/${encodeURIComponent(id)}`),
  search: (q: string) => get<{ ok: true; data: PersonBrief[] }>('/api/search', { q }),
};
