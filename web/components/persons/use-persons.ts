'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, type PersonBrief } from '@/lib/api';

export interface PersonsState {
  persons: PersonBrief[];
  total: number;
  loading: boolean;
  error: string | null;
}

/** 取某朝代的代表人物（按 fame_score 排序） */
export function useDynastyPersons(dynastyId: string | null, limit = 80) {
  const [state, setState] = useState<PersonsState>({
    persons: [],
    total: 0,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!dynastyId) {
      setState({ persons: [], total: 0, loading: false, error: null });
      return;
    }
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    api
      .persons({ dynasty: dynastyId, min_prom: 4, limit })
      .then((r) => {
        if (!alive) return;
        setState({ persons: r.data, total: r.total ?? r.data.length, loading: false, error: null });
      })
      .catch((e) => {
        if (!alive) return;
        setState({ persons: [], total: 0, loading: false, error: String(e?.message || e) });
      });
    return () => {
      alive = false;
    };
  }, [dynastyId, limit]);

  return state;
}

/** 搜索人物（跨全部朝代） */
export function usePersonSearch() {
  const [results, setResults] = useState<PersonBrief[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');

  const run = useCallback(async (query: string) => {
    setQ(query);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const r = await api.search(query.trim());
      setResults(r.data);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, loading, q, run };
}
