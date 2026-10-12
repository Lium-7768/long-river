'use client';

/**
 * 疆域示意覆盖（省份）——运行时从 /api/territory-coverage 取，模块级缓存。
 */
import { useEffect, useState } from 'react';
import { api } from './api';

type Coverage = { provinces: string[]; note?: string };

let _cache: Record<string, Coverage> | null = null;
let _inflight: Promise<Record<string, Coverage>> | null = null;

export async function loadCoverage(): Promise<Record<string, Coverage>> {
  if (_cache) return _cache;
  if (_inflight) return _inflight;
  _inflight = api.territoryCoverage().then((r) => {
    _cache = r.data;
    _inflight = null;
    return _cache;
  });
  return _inflight;
}

/** 同步读取（需先 loadCoverage 或 useCoverage 预热） */
export function getCoverage(id: string): Coverage | undefined {
  return _cache?.[id];
}

export function useCoverage(id: string): Coverage | undefined {
  const [cov, setCov] = useState<Coverage | undefined>(_cache?.[id]);
  useEffect(() => {
    let alive = true;
    loadCoverage()
      .then((c) => alive && setCov(c[id]))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [id]);
  return cov;
}
