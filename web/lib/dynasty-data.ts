'use client';

/**
 * 朝代数据层（运行时 API）
 * ------------------------------------------------------------
 * 所有朝代元数据 / 档案内容来自后端 SQLite（不再是前端硬编码 .ts）。
 *   朝代轴   → /api/dynasties
 *   档案     → /api/dynasty-profile?dynasty=
 *   疆域示意 → /api/territory-coverage
 */
import { useEffect, useState } from 'react';
import { api, type DynastyMeta, type DynastyProfileData } from './api';

export type { DynastyMeta, DynastyProfileData };

/** L1 时间长河用的朝代（沿用旧 Dynasty 字段名）*/
export interface Dynasty {
  id: string;
  name: string;
  start: number;
  end: number;
  note: string;
  colorVar: string;
}

function toDynasty(m: DynastyMeta): Dynasty {
  return {
    id: m.id,
    name: m.name,
    start: m.start,
    end: m.end,
    note: m.note,
    colorVar: m.color_var,
  };
}

/** 全量朝代轴（缓存，避免多组件重复请求）*/
let _cache: Dynasty[] | null = null;
let _inflight: Promise<Dynasty[]> | null = null;

export async function loadDynasties(): Promise<Dynasty[]> {
  if (_cache) return _cache;
  if (_inflight) return _inflight;
  _inflight = api.dynasties().then((r) => {
    _cache = r.data.map(toDynasty);
    _inflight = null;
    return _cache;
  });
  return _inflight;
}

/** React hook：加载朝代轴 */
export function useDynasties() {
  const [dynasties, setDynasties] = useState<Dynasty[]>(_cache || []);
  const [loading, setLoading] = useState(!_cache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadDynasties()
      .then((d) => alive && (setDynasties(d), setLoading(false)))
      .catch((e) => alive && (setError(String(e)), setLoading(false)));
    return () => {
      alive = false;
    };
  }, []);

  return { dynasties, loading, error };
}

/** React hook：取单个朝代名（用于面包屑）*/
export function useDynastyName(id: string | undefined): string {
  const { dynasties } = useDynasties();
  if (!id) return '朝代';
  return dynasties.find((d) => d.id === id)?.name ?? '朝代';
}
