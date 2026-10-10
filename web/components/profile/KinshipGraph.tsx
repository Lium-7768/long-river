'use client';

import { useMemo, useRef, useState } from 'react';
import type { Kinship } from '@/lib/api';

/**
 * 亲属关系图（径向星座式 + 可交互）。
 * - 拖拽平移 / 滚轮缩放 / 双击复位
 * - 点节点 → 回调 onPick(id, name)（由父级打开抽屉）
 * 数据是扁平 (rel, name) 对，非树，故用分类 + 径向布局。
 */

type Category = 'ancestor' | 'descendant' | 'sibling' | 'spouse' | 'affine' | 'other';

const CAT_META: Record<Category, { label: string; color: string; glow: string }> = {
  ancestor: { label: '长辈 / 祖先', color: '#7dd3fc', glow: 'rgba(125,211,252,0.5)' },
  descendant: { label: '晚辈 / 后裔', color: '#6ee7b7', glow: 'rgba(110,231,183,0.5)' },
  sibling: { label: '同辈 / 兄弟', color: '#fbbf24', glow: 'rgba(251,191,36,0.5)' },
  spouse: { label: '配偶', color: '#f472b6', glow: 'rgba(244,114,182,0.5)' },
  affine: { label: '姻亲', color: '#a78bfa', glow: 'rgba(167,139,250,0.5)' },
  other: { label: '其他亲属', color: '#94a3b8', glow: 'rgba(148,163,184,0.4)' },
};

function classify(rel: string): { cat: Category; label: string } {
  const r = rel
    .replace(/[（(]反向[）)]/g, '')
    .split(';')[0]
    .trim();
  const t = r.replace(/從/g, '从').replace(/姪/g, '侄').replace(/孫/g, '孙');
  if (/父|母|祖|曾祖|高祖|太曾|先祖|直系祖先/.test(t)) return { cat: 'ancestor', label: short(t) };
  if (/子|孙|後?后裔|裔|女$/.test(t) && !/妻|父/.test(t))
    return { cat: 'descendant', label: short(t) };
  if (/兄|弟|姊妹|姐|从兄|从弟|表/.test(t)) return { cat: 'sibling', label: short(t) };
  if (/妻|丈夫|夫|妾|继室|正室/.test(t)) return { cat: 'spouse', label: short(t) };
  if (/岳|丈人|女婿|媳|妻父|姻/.test(t)) return { cat: 'affine', label: short(t) };
  return { cat: 'other', label: short(t) };
}

function short(t: string): string {
  const m: Record<string, string> = {
    直系祖先: '先祖',
    直系后裔: '后裔',
    从子: '侄子',
    从祖: '伯叔祖',
    伯叔祖: '伯叔祖',
    从父: '叔伯',
    伯叔父: '叔伯',
    从兄: '从兄',
    从弟: '从弟',
    姨表兄弟: '表兄弟',
    第一任妻父: '岳父',
    妻父: '岳父',
  };
  return m[t] ?? t;
}

interface Pt {
  id: string;
  name: string;
  label: string;
  cat: Category;
  x: number;
  y: number;
}

export function KinshipGraph({
  kinships,
  onPick,
}: {
  kinships: Kinship[];
  onPick?: (id: string, name: string) => void;
}) {
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const drag = useRef<{ sx: number; sy: number; vx: number; vy: number } | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const { points, cats } = useMemo(() => {
    const byCat = new Map<Category, Kinship[]>();
    for (const k of kinships) {
      const { cat } = classify(k.rel);
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat)!.push(k);
    }
    const clean = (arr: Kinship[]) =>
      arr.filter((k) => k.name && !/^[A-Za-z0-9?？]{1,2}$/.test(k.name) && !k.name.includes('?'));

    const CX = 200;
    const CY = 200;
    const R = 150;
    const order: Category[] = ['ancestor', 'descendant', 'sibling', 'spouse', 'affine', 'other'];
    const present = order.filter((c) => byCat.has(c));
    const pts: Pt[] = [];
    const catInfo: { cat: Category; count: number }[] = [];

    present.forEach((cat, ci) => {
      const all = byCat.get(cat)!;
      const items = clean(all);
      catInfo.push({ cat, count: all.length });
      const show = items.slice(0, 18);
      const n = show.length || 1;
      const sectorCenter = (ci / present.length) * Math.PI * 2 - Math.PI / 2;
      const sectorSpan = ((Math.PI * 2) / present.length) * 0.82;
      show.forEach((k, i) => {
        const t = n === 1 ? 0.5 : i / (n - 1);
        const ang = sectorCenter + (t - 0.5) * sectorSpan;
        const rr = R * (0.92 + (i % 3) * 0.03);
        pts.push({
          id: k.id,
          name: k.name,
          label: classify(k.rel).label,
          cat,
          x: CX + Math.cos(ang) * rr,
          y: CY + Math.sin(ang) * rr,
        });
      });
    });
    return { points: pts, cats: catInfo };
  }, [kinships]);

  const colorOf = (c: Category) => CAT_META[c].color;

  // 拖拽平移
  const onDown = (e: React.PointerEvent) => {
    drag.current = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.sx;
    const dy = e.clientY - drag.current.sy;
    setView((v) => ({ ...v, x: drag.current!.vx + dx, y: drag.current!.vy + dy }));
  };
  const onUp = () => {
    drag.current = null;
  };
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    setView((v) => ({ ...v, k: Math.min(4, Math.max(0.5, v.k * factor)) }));
  };
  const reset = () => setView({ x: 0, y: 0, k: 1 });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap gap-3">
          {cats.map(({ cat, count }) => (
            <span key={cat} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: colorOf(cat) }}
              />
              <span className="text-white/50">
                {CAT_META[cat].label} {count}
              </span>
            </span>
          ))}
        </div>
        <button
          onClick={reset}
          className="rounded border border-white/15 px-2 py-0.5 text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          复位
        </button>
      </div>

      <svg
        viewBox="0 0 400 400"
        className="mx-auto w-full max-w-[520px] cursor-grab touch-none select-none active:cursor-grabbing"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        onWheel={onWheel}
        onDoubleClick={reset}
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {/* 连接线 */}
          {points.map((pt, i) => (
            <line
              key={`l${i}`}
              x1="200"
              y1="200"
              x2={pt.x}
              y2={pt.y}
              stroke={colorOf(pt.cat)}
              strokeWidth="0.5"
              opacity={hover && hover !== pt.id ? 0.12 : 0.25}
            />
          ))}
          {/* 本人 */}
          <circle cx="200" cy="200" r="16" fill="#0b1120" stroke="#38bdf8" strokeWidth="1.5" />
          <circle
            cx="200"
            cy="200"
            r="22"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="0.6"
            opacity="0.4"
          />
          <text
            x="200"
            y="200"
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="7"
            fill="#7dd3fc"
          >
            本人
          </text>
          {/* 亲属节点 */}
          {points.map((pt, i) => {
            const active = hover === pt.id;
            return (
              <g
                key={`n${i}`}
                className="cursor-pointer"
                onPointerEnter={() => setHover(pt.id)}
                onPointerLeave={() => setHover(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  onPick?.(pt.id, pt.name);
                }}
              >
                {/* 放大点击热区 */}
                <circle cx={pt.x} cy={pt.y} r="9" fill="transparent" />
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={active ? 5 : 3.5}
                  fill={colorOf(pt.cat)}
                  style={{
                    filter: `drop-shadow(0 0 ${active ? 6 : 3}px ${CAT_META[pt.cat].glow})`,
                  }}
                />
                <text
                  x={pt.x}
                  y={pt.y - 6}
                  textAnchor="middle"
                  fontSize={active ? 8 : 7}
                  fill={active ? '#fff' : 'rgba(255,255,255,0.72)'}
                >
                  {pt.name}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      <div className="mt-1 text-center text-[11px] text-white/30">
        共 {kinships.length} 条亲属 · 拖拽平移 / 滚轮缩放 / 双击复位 · 点击查看详情
      </div>
    </div>
  );
}
