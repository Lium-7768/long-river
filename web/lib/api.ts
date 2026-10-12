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
  top_office?: string | null;
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
  role?: string | null;
}

export interface Evidence {
  claim_type: string;
  src_book: string | null;
  src_pages: string | null;
}

export interface Poem {
  id: number;
  title: string;
  author?: string;
  dynasty?: string;
  genre?: string;
  content?: string;
  excerpt?: string;
  n_lines: number;
}

export interface PoemAuthor {
  name: string;
  dynasty: string | null;
  n_poems: number;
}

export interface Note {
  kind: string;
  note: string;
}
export interface Possession {
  desc: string;
  quantity: number | null;
  year: number | null;
}
export interface Institution {
  name: string;
  begin_year: number | null;
  end_year: number | null;
  source: string | null;
}

export interface PersonDetail extends PersonBrief {
  ethnicity?: string | null;
  household?: string | null;
  death_age?: number | null;
  notes?: Note[];
  possessions?: Possession[];
  institutions?: Institution[];
  hao: string[];
  shi: string[];
  addr: string[];
  sources: string[];
  birth_evid?: string | null;
  death_evid?: string | null;
  officeAddrs?: string[];
  evid?: Evidence[];
  poems?: Poem[];
  nPoems?: number;
  kinships: Kinship[];
  offices: Office[];
  entries: Entry[];
  works: Work[];
  texts?: { title: string; role: string; year: number }[];
  qid?: string | null;
  birth_exact?: string | null;
  death_exact?: string | null;
  aliases?: { alias: string; type_desc: string }[];
  occupations?: string[];
  birthplaces?: string[];
  statuses?: { status: string; fy: number; ly: number }[];
  network?: { n_out: number; n_in: number; n_types: number } | null;
  excerpts?: { book: string; volume: string; excerpt: string }[];
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
  poems: (
    p: {
      q?: string;
      author?: string;
      dynasty?: string;
      genre?: string;
      limit?: number;
      offset?: number;
    } = {},
  ) => get<{ ok: true; data: Poem[]; total?: number }>('/api/poems', p),
  poem: (id: number | string) => get<{ ok: true; data: Poem }>(`/api/poems/${id}`),
  poemAuthors: (limit = 100) =>
    get<{ ok: true; data: PoemAuthor[] }>('/api/poem-authors', { limit }),
  dynastyPoems: (dynasty: string) =>
    get<{
      ok: true;
      data: {
        genres: { genre: string; n: number }[];
        authors: { name: string; n: number }[];
        featured: Poem[];
      };
    }>('/api/dynasty-poems', { dynasty }),
  personGeo: (dynasty: string, limit = 200) =>
    get<{ ok: true; data: { name: string; lon: number; lat: number; n: number }[] }>(
      '/api/person-geo',
      { dynasty, limit },
    ),
  regionStats: (q?: string) =>
    get<{ ok: true; data: { region: string; kaiyuan_hu: number; yuanhe_hu: number }[] }>(
      '/api/region-stats',
      q ? { q } : {},
    ),
};
