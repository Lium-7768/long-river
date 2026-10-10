'use client';

import { useMemo } from 'react';

/**
 * 疆域「地图感」展示 —— 不用真地图。
 * 用程序化生成的抽象轮廓（发光多边形）+ 都城标记 + 文字说明。
 * 与第一层「星空/光」风格统一。
 */

// 用每个朝代的种子生成一个不规则闭合轮廓（伪随机、稳定）
function makeOutline(seed: string, points = 14): [number, number][] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xffffffff;
  const rand = () => {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    return h / 0x7fffffff;
  };
  const out: [number, number][] = [];
  for (let i = 0; i < points; i++) {
    const ang = (i / points) * Math.PI * 2;
    const r = 42 + rand() * 26; // 42–68
    out.push([100 + Math.cos(ang) * r, 60 + Math.sin(ang) * r * 0.72]);
  }
  return out;
}

function smoothPath(pts: [number, number][]): string {
  if (pts.length < 3) return '';
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    d += ` Q ${a[0]} ${a[1]} ${mx} ${my}`;
  }
  return d + ' Z';
}

export function Territory({
  id,
  capital,
  extent,
  note,
}: {
  id: string;
  capital: string;
  extent: string;
  note?: string;
}) {
  const path = useMemo(() => smoothPath(makeOutline(id)), [id]);
  const innerPath = useMemo(() => smoothPath(makeOutline(id + '-inner', 12)), [id]);

  return (
    <div className="grid gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-5 sm:grid-cols-[240px_1fr]">
      {/* 抽象疆域轮廓 */}
      <div className="relative">
        <svg viewBox="0 0 200 120" className="w-full">
          <defs>
            <radialGradient id={`tg-${id}`} cx="50%" cy="50%" r="60%">
              <stop offset="0%" stopColor="rgb(56 189 248 / 0.35)" />
              <stop offset="100%" stopColor="rgb(56 189 248 / 0)" />
            </radialGradient>
            <linearGradient id={`tl-${id}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#7dd3fc" />
              <stop offset="100%" stopColor="#818cf8" />
            </linearGradient>
          </defs>
          {/* 光晕填充 */}
          <path d={path} fill={`url(#tg-${id})`} />
          {/* 轮廓线 */}
          <path
            d={path}
            fill="none"
            stroke={`url(#tl-${id})`}
            strokeWidth="1.5"
            style={{ filter: 'drop-shadow(0 0 4px rgba(125,211,252,0.6))' }}
          />
          {/* 内圈纹理 */}
          <path d={innerPath} fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth="0.8" />
          {/* 都城标记 */}
          <circle
            cx="100"
            cy="60"
            r="3.5"
            fill="#fbbf24"
            style={{ filter: 'drop-shadow(0 0 4px #fbbf24)' }}
          />
          <circle
            cx="100"
            cy="60"
            r="8"
            fill="none"
            stroke="#fbbf24"
            strokeWidth="0.6"
            opacity="0.5"
          />
        </svg>
        <div className="mt-1 text-center text-[11px] text-amber-300/70">◆ 都城</div>
      </div>

      {/* 文字 */}
      <div className="space-y-2 text-sm">
        <div className="flex gap-3">
          <span className="w-14 shrink-0 text-white/40">都城</span>
          <span className="text-white/80">{capital}</span>
        </div>
        <div className="flex gap-3">
          <span className="w-14 shrink-0 text-white/40">疆域</span>
          <span className="text-white/70">{extent}</span>
        </div>
        {note && (
          <div className="flex gap-3">
            <span className="w-14 shrink-0 text-white/40">备注</span>
            <span className="text-white/60">{note}</span>
          </div>
        )}
      </div>
    </div>
  );
}
