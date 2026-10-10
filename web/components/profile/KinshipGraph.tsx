'use client';

import { useMemo, useRef, useState } from 'react';
import type { Kinship } from '@/lib/api';

/**
 * 亲属关系图：放射状布局 + 连线。
 * 节点「只展示文字」——不画圆点，直接用彩色姓名（颜色 = 关系类别）。
 * 可拖拽平移 / 滚轮缩放 / 双击复位；点文字查看详情。
 */

type Category = 'ancestor' | 'descendant' | 'sibling' | 'spouse' | 'affine' | 'other';

const CAT_META: Record<Category, { label: string; color: string }> = {
  ancestor: { label: '长辈 / 祖先', color: '#7dd3fc' },
  descendant: { label: '晚辈 / 后裔', color: '#6ee7b7' },
  sibling: { label: '同辈 / 兄弟', color: '#fbbf24' },
  spouse: { label: '配偶', color: '#f472b6' },
  affine: { label: '姻亲', color: '#a78bfa' },
  other: { label: '其他亲属', color: '#94a3b8' },
};

function classify(rel: string): Category {
  const t = rel
    .replace(/[（(]反向[）)]/g, '')
    .split(';')[0]
    .trim()
    .replace(/從/g, '从')
    .replace(/姪/g, '侄')
    .replace(/孫/g, '孙');
  if (/父|母|祖|曾祖|高祖|太曾|先祖|直系祖先/.test(t)) return 'ancestor';
  if (/子|孙|後?后裔|裔|女$/.test(t) && !/妻|父/.test(t)) return 'descendant';
  if (/兄|弟|姊妹|姐|从兄|从弟|表/.test(t)) return 'sibling';
  if (/妻|丈夫|夫|妾|继室|正室/.test(t)) return 'spouse';
  if (/岳|丈人|女婿|媳|妻父|姻/.test(t)) return 'affine';
  return 'other';
}

function validName(name: string): boolean {
  return !!name && !/^[A-Za-z0-9?？]{1,2}$/.test(name) && !name.includes('?');
}

interface Pt {
  id: string;
  name: string;
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
      const c = classify(k.rel);
      if (!byCat.has(c)) byCat.set(c, []);
      byCat.get(c)!.push(k);
    }
    const CX = 200;
    const CY = 200;
    const order: Category[] = ['ancestor', 'descendant', 'sibling', 'spouse', 'affine', 'other'];
    const present = order.filter((c) => byCat.has(c));
    const pts: Pt[] = [];
    const catInfo: { cat: Category; count: number }[] = [];

    present.forEach((cat, ci) => {
      const all = byCat.get(cat)!;
      catInfo.push({ cat, count: all.length });
      const items = all.filter((k) => validName(k.name)).slice(0, 15);
      const n = items.length || 1;
      const sectorCenter = (ci / present.length) * Math.PI * 2 - Math.PI / 2;
      const sectorSpan = ((Math.PI * 2) / present.length) * 0.85;
      items.forEach((k, i) => {
        const t = n === 1 ? 0.5 : i / (n - 1);
        const ang = sectorCenter + (t - 0.5) * sectorSpan;
        // 分层半径，避免文字重叠
        const rr = 110 + (i % 3) * 42;
        pts.push({
          id: k.id,
          name: k.name,
          cat,
          x: CX + Math.cos(ang) * rr,
          y: CY + Math.sin(ang) * rr,
        });
      });
    });
    return { points: pts, cats: catInfo };
  }, [kinships]);

  const onDown = (e: React.PointerEvent) => {
    drag.current = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setView((v) => ({
      ...v,
      x: drag.current!.vx + (e.clientX - drag.current!.sx),
      y: drag.current!.vy + (e.clientY - drag.current!.sy),
    }));
  };
  const onUp = () => {
    drag.current = null;
  };
  const onWheel = (e: React.WheelEvent) => {
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    setView((v) => ({ ...v, k: Math.min(4, Math.max(0.6, v.k * factor)) }));
  };
  const reset = () => setView({ x: 0, y: 0, k: 1 });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-base">
        <div className="flex flex-wrap gap-3">
          {cats.map(({ cat, count }) => (
            <span key={cat} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: CAT_META[cat].color }}
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
        className="mx-auto w-full max-w-[620px] cursor-grab touch-none select-none active:cursor-grabbing"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        onWheel={onWheel}
        onDoubleClick={reset}
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {/* 连线 */}
          {points.map((pt, i) => (
            <line
              key={`l${i}`}
              x1="200"
              y1="200"
              x2={pt.x}
              y2={pt.y}
              stroke={CAT_META[pt.cat].color}
              strokeWidth="0.4"
              opacity={hover && hover !== pt.id ? 0.08 : 0.25}
            />
          ))}
          {/* 本人 */}
          <text
            x="200"
            y="200"
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="11"
            fill="#38bdf8"
            fontWeight="600"
          >
            本人
          </text>
          {/* 亲属：只展示文字，无圆点 */}
          {points.map((pt, i) => {
            const active = hover === pt.id;
            return (
              <text
                key={`t${i}`}
                x={pt.x}
                y={pt.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={active ? 9.5 : 8}
                fontWeight={active ? 600 : 400}
                fill={active ? '#ffffff' : CAT_META[pt.cat].color}
                className="cursor-pointer"
                style={
                  active ? { filter: `drop-shadow(0 0 4px ${CAT_META[pt.cat].color})` } : undefined
                }
                onPointerEnter={() => setHover(pt.id)}
                onPointerLeave={() => setHover(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  onPick?.(pt.id, pt.name);
                }}
              >
                {pt.name}
              </text>
            );
          })}
        </g>
      </svg>
      <div className="mt-1 text-center text-base text-white/30">
        共 {kinships.length} 条亲属 · 拖拽平移 / 滚轮缩放 / 双击复位 · 点击姓名查看详情
      </div>
    </div>
  );
}
