'use client';

import { useEffect, useState } from 'react';
import { api, type Poem } from '@/lib/api';

export interface DynastyPoems {
  genres: { genre: string; n: number }[];
  authors: { name: string; n: number }[];
  featured: Poem[];
}

/** 取某朝代的诗词概况（体裁/诗人/名篇） */
export function useDynastyPoems(dynastyId: string | null) {
  const [state, setState] = useState<DynastyPoems>({
    genres: [],
    authors: [],
    featured: [],
  });

  useEffect(() => {
    if (!dynastyId) return;
    let alive = true;
    api
      .dynastyPoems(dynastyId)
      .then((r) => {
        if (alive) setState(r.data);
      })
      .catch(() => {
        /* 该朝代无诗词则留空 */
      });
    return () => {
      alive = false;
    };
  }, [dynastyId]);

  return state;
}
