'use client';

import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { Scene } from './Scene';
import type { CameraMode } from './cameraModes';
import { DYNASTIES, DYNASTIES_WITH_DATA, type Dynasty } from '@/content/dynasties';

const hasData = (id: string) => DYNASTIES_WITH_DATA.has(id);

/**
 * 滚动驱动的时间长河。
 * 滚轮/拖动 → progress 0→1 → 相机沿河道飞行，朝代依次经过。
 * 用 ref 传 progress 给 R3F（避免每帧重渲染 React）。
 * 覆盖层用 DOM 渲染中文（清晰）。
 */
export function RiverExperience() {
  const progress = useRef(0);
  const target = useRef(0);
  const [picked, setPicked] = useState<Dynasty | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [mode, setMode] = useState<CameraMode>('fly');

  // 滚轮 → 目标进度
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      target.current += Math.sign(e.deltaY) * 0.012 * Math.min(Math.abs(e.deltaY) / 100, 1.5);
      target.current = Math.max(0, Math.min(1, target.current));
    };
    let touchY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      const dy = touchY - e.touches[0].clientY;
      touchY = e.touches[0].clientY;
      target.current += Math.sign(dy) * 0.01 * Math.min(Math.abs(dy) / 30, 1.5);
      target.current = Math.max(0, Math.min(1, target.current));
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }, []);

  // 每帧缓动 progress，并算出当前朝代
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      progress.current += (target.current - progress.current) * 0.08;
      const idx = Math.round(progress.current * (DYNASTIES.length - 1));
      setActiveIdx((p) => (p === idx ? p : idx));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const cur = DYNASTIES[activeIdx];
  const pct = Math.round(progress.current * 100);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#03060f]">
      <Canvas
        camera={{ position: [0, 1.6, 3.2], fov: 55, near: 0.1, far: 200 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
        dpr={[1, 1.75]}
      >
        <Scene progress={progress} mode={mode} onPick={(i) => setPicked(DYNASTIES[i])} />
      </Canvas>

      {/* ---------- 覆盖层（DOM，中文绝对清晰）---------- */}
      {/* 顶部标题 */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 flex items-center justify-between px-8 py-6">
        <span className="text-xl font-semibold tracking-[0.4em] text-white/90">长河</span>
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={() => setMode('fly')}
            className={`rounded-full px-3 py-1 text-xs tracking-wider transition ${mode === 'fly' ? 'bg-sky-400/90 text-black' : 'border border-white/20 text-white/60 hover:text-white'}`}
          >
            沿河飞行
          </button>
          <button
            onClick={() => setMode('side')}
            className={`rounded-full px-3 py-1 text-xs tracking-wider transition ${mode === 'side' ? 'bg-sky-400/90 text-black' : 'border border-white/20 text-white/60 hover:text-white'}`}
          >
            侧览全景
          </button>
        </div>
      </div>

      {/* 左侧：当前朝代大字 */}
      <div
        key={activeIdx}
        className="pointer-events-none absolute bottom-16 left-10 max-w-md animate-[fadeUp_0.6s_ease]"
      >
        <div className="text-[13px] tracking-[0.3em] text-sky-300/70">
          {cur.start < 0 ? `公元前 ${-cur.start}` : `公元 ${cur.start}`}
          {' — '}
          {cur.end < 0 ? `公元前 ${-cur.end}` : `公元 ${cur.end}`}
        </div>
        <h2 className="mt-3 text-7xl font-semibold leading-none tracking-tight text-white drop-shadow-[0_2px_20px_rgba(0,180,255,0.35)]">
          {cur.name}
        </h2>
        <p className="mt-3 text-sm tracking-wide text-white/50">
          {hasData(cur.id) ? `${cur.note} · 点击节点进入` : cur.note}
        </p>
      </div>

      {/* 右侧：进度 */}
      <div className="pointer-events-none absolute right-10 top-1/2 flex -translate-y-1/2 flex-col items-center gap-3">
        <span className="text-xs tabular-nums text-white/40">{pct}%</span>
        <div className="h-48 w-px bg-white/15">
          <div
            className="w-px bg-sky-400 transition-[height] duration-200"
            style={{ height: `${pct}%` }}
          />
        </div>
      </div>

      {/* 底部提示 */}
      <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 text-xs tracking-widest text-white/30">
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
            <div className="text-xs tracking-[0.3em] text-sky-300/70">
              {picked.start < 0 ? `公元前 ${-picked.start}` : `公元 ${picked.start}`} —{' '}
              {picked.end < 0 ? `公元前 ${-picked.end}` : `公元 ${picked.end}`}
            </div>
            <h3 className="mt-4 text-5xl font-semibold text-white">{picked.name}</h3>
            <p className="mt-4 text-sm text-white/60">{picked.note}</p>
            <p className="mt-8 text-xs text-white/40">第二层「人物与事件」即将呈现</p>
            <button
              onClick={() => setPicked(null)}
              className="mt-8 rounded-full border border-white/20 px-6 py-2 text-sm text-white/80 transition hover:bg-white/10"
            >
              返回
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
