'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
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

export interface PersonSearchState {
  results: PersonBrief[];
  loading: boolean;
  error: string | null;
  q: string;
  run: (query: string) => void;
}

/**
 * 搜索人物（跨全部朝代）。
 * - 300ms 防抖，避免每次击键都发请求。
 * - 竞态保护：仅采纳最后一次请求的结果。
 * - 区分「无结果」与「请求失败」。
 */
export function usePersonSearch(): PersonSearchState {
  const [results, setResults] = useState<PersonBrief[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback((query: string) => {
    setQ(query);
    const trimmed = query.trim();
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;

    if (!trimmed) {
      seq.current++;
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    const mySeq = ++seq.current;
    setLoading(true);
    setError(null);

    timer.current = setTimeout(async () => {
      try {
        const r = await api.search(trimmed);
        if (mySeq !== seq.current) return;
        setResults(r.data);
        setLoading(false);
      } catch (e) {
        if (mySeq !== seq.current) return;
        setResults([]);
        setError(String((e as { message?: string })?.message || e));
        setLoading(false);
      }
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return { results, loading, error, q, run };
}
