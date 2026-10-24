'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { Scene } from './Scene';
import type { CameraMode } from './cameraModes';
import { fmtRange } from './year';
import { useDynasties, type Dynasty } from '@/lib/dynasty-data';
import { useWebGLAvailable } from '@/lib/webgl';

/**
 * 滚动驱动的时间长河。
 * 滚轮/拖动 → progress 0→1 → 相机沿河道飞行，朝代依次经过。
 * 用 ref 传 progress 给 R3F（避免每帧重渲染 React）。
 * 覆盖层用 DOM 渲染中文（清晰）。
 * 朝代轴数据来自后端 /api/dynasties。
 */
export function RiverExperience({ onEnterDynasty }: { onEnterDynasty?: (d: Dynasty) => void }) {
  const { dynasties, loading } = useDynasties();
  const progress = useRef(0);
  const target = useRef(0);
  const [picked, setPicked] = useState<Dynasty | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [mode, setMode] = useState<CameraMode>('fly');
  const webgl = useWebGLAvailable();
  const hasData = (id: string) => dynasties.some((d) => d.id === id);

  // 滚轮/拖动仅在 L1 全屏容器上拦截，避免在 /dynasty/* 上全局 preventDefault 导致无法滚动
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartTarget = useRef(0);
  const velocity = useRef(0);
  const lastDragX = useRef(0);
  const lastDragT = useRef(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      target.current += Math.sign(delta) * 0.012 * Math.min(Math.abs(delta) / 100, 1.5);
      target.current = Math.max(0, Math.min(1, target.current));
    };
    let touchY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      const dy = touchY - e.touches[0].clientY;
      touchY = e.touches[0].clientY;
      e.preventDefault();
      target.current += Math.sign(dy) * 0.01 * Math.min(Math.abs(dy) / 30, 1.5);
      target.current = Math.max(0, Math.min(1, target.current));
    };
    const onPointerDown = (e: PointerEvent) => {
      isDragging.current = true;
      dragStartX.current = e.clientX;
      dragStartTarget.current = target.current;
      lastDragX.current = e.clientX;
      lastDragT.current = performance.now();
      (e.target as Element).setPointerCapture?.(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - dragStartX.current;
      const delta = -dx / Math.max(400, window.innerWidth * 0.6);
      target.current = Math.max(0, Math.min(1, dragStartTarget.current + delta));
      const now = performance.now();
      velocity.current = (e.clientX - lastDragX.current) / (now - lastDragT.current || 1);
      lastDragX.current = e.clientX;
      lastDragT.current = now;
    };
    const onPointerUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      target.current = Math.max(0, Math.min(1, target.current + velocity.current * 0.12));
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        target.current = Math.min(1, target.current + 0.06);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        target.current = Math.max(0, target.current - 0.06);
      } else if (e.key === 'Home') {
        e.preventDefault();
        target.current = 0;
      } else if (e.key === 'End') {
        e.preventDefault();
        target.current = 1;
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  // 每帧缓动 progress，并算出当前朝代
  useEffect(() => {
    if (!dynasties.length) return;
    let raf = 0;
    const tick = () => {
      progress.current += (target.current - progress.current) * 0.08;
      const idx = Math.round(progress.current * (dynasties.length - 1));
      setActiveIdx((p) => (p === idx ? p : idx));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [dynasties.length]);

  const cur = dynasties[activeIdx];
  const pct = Math.round(progress.current * 100);

  if (loading || !cur) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#03060f] text-white/40">
        载入时间长河…
      </div>
    );
  }

  // 无 WebGL → 2D 朝代列表回退（不崩页，每个朝代仍可进）
  if (webgl === false) {
    return (
      <div className="min-h-screen w-screen bg-[#03060f] px-6 py-16 text-white">
        <div className="mx-auto max-w-3xl space-y-6">
          <header>
            <div className="text-base tracking-[0.4em] text-sky-300/70">长河</div>
            <h1 className="mt-3 text-5xl font-semibold tracking-tight">中国历史 · 朝代</h1>
            <p className="mt-3 text-base leading-relaxed text-white/50">
              当前环境不支持 3D，已用列表呈现。点击朝代进入档案。
            </p>
          </header>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {dynasties.map((d) => (
              <button
                key={d.id}
                onClick={() => {
                  if (onEnterDynasty) onEnterDynasty(d);
                  else setPicked(d);
                }}
                className="cursor-pointer rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:border-sky-400/40 hover:bg-sky-400/[0.07]"
              >
                <div className="text-base font-medium text-white/90">{d.name}</div>
                <div className="mt-1 text-base tabular-nums text-white/40">
                  {fmtRange(d.start, d.end)}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-screen w-screen overflow-hidden bg-[#03060f]">
      <Canvas
        camera={{ position: [0, 1.6, 3.2], fov: 55, near: 0.1, far: 200 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
        dpr={[1, 1.75]}
      >
        <Scene
          dynasties={dynasties}
          progress={progress}
          mode={mode}
          onPick={(i) => {
            if (onEnterDynasty) onEnterDynasty(dynasties[i]);
            else setPicked(dynasties[i]);
          }}
        />
      </Canvas>

      {/* ---------- 覆盖层（DOM，中文绝对清晰）---------- */}
      {/* 左上角标题 */}
      <div className="absolute left-0 top-0 flex items-center gap-3 px-4 py-4 sm:gap-4 sm:px-8 sm:py-6">
        <span className="pointer-events-none text-xl font-semibold tracking-[0.4em] text-white/90">
          长河
        </span>
        <Link
          href="/sources"
          className="pointer-events-auto rounded-full border border-white/20 px-3 py-1 text-base text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          史料来源
        </Link>
      </div>

      {/* 右上角：视角切换 + 当前朝代信息 */}
      <div className="absolute right-4 top-4 flex flex-col items-end gap-3 sm:right-8 sm:top-6 sm:gap-5">
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={() => setMode('fly')}
            className={`rounded-full px-3 py-1 text-base tracking-wider transition ${mode === 'fly' ? 'bg-sky-400/90 text-black' : 'border border-white/20 text-white/60 hover:text-white'}`}
          >
            沿河飞行
          </button>
          <button
            onClick={() => setMode('side')}
            className={`rounded-full px-3 py-1 text-base tracking-wider transition ${mode === 'side' ? 'bg-sky-400/90 text-black' : 'border border-white/20 text-white/60 hover:text-white'}`}
          >
            侧览全景
          </button>
        </div>

        {/* 当前朝代：右上，右对齐 */}
        <div key={activeIdx} className="pointer-events-none animate-[fadeUp_0.6s_ease] text-right">
          <div className="text-base tracking-[0.3em] text-sky-300/70">
            {fmtRange(cur.start, cur.end)}
          </div>
          <h2 className="mt-2 text-4xl font-semibold leading-none tracking-tight text-white drop-shadow-[0_2px_20px_rgba(0,180,255,0.35)] sm:text-6xl">
            {cur.name}
          </h2>
          <p className="mt-2 max-w-[60vw] text-base tracking-wide text-white/50 sm:max-w-none">
            {hasData(cur.id) ? `${cur.note} · 点击节点进入` : cur.note}
          </p>
        </div>
      </div>

      {/* 右侧：进度 */}
      <div className="pointer-events-none absolute bottom-24 right-4 hidden flex-col items-center gap-3 sm:right-10 sm:flex">
        <span className="text-base tabular-nums text-white/40">{pct}%</span>
        <div className="h-48 w-px bg-white/15">
          <div
            className="w-px bg-sky-400 transition-[height] duration-200"
            style={{ height: `${pct}%` }}
          />
        </div>
      </div>

      {/* 底部提示 */}
      <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 text-base tracking-widest text-white/30">
        ↓ 滚动 / 拖动 前行
      </div>

      {/* 详情弹层 */}
      {picked && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-md"
          onClick={() => setPicked(null)}
        >
          <div
            className="w-[min(560px,90vw)] rounded-3xl border border-white/10 bg-[#0a111f]/95 p-10 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-base tracking-[0.3em] text-sky-300/70">
              {fmtRange(picked.start, picked.end)}
            </div>
            <h3 className="mt-4 text-5xl font-semibold text-white">{picked.name}</h3>
            <p className="mt-4 text-base text-white/60">{picked.note}</p>
            <p className="mt-8 text-base text-white/40">第二层「人物与事件」即将呈现</p>
            <button
              onClick={() => setPicked(null)}
              className="mt-8 rounded-full border border-white/20 px-6 py-2 text-base text-white/80 transition hover:bg-white/10"
            >
              返回
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
