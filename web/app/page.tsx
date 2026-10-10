'use client';

import { ThemeToggle } from '@/components/theme-toggle';

/**
 * 首页 —— 视觉方向待定。
 * 已否决：3D 时间轴（方块/粒子/玻璃）、Apple 极简网格。
 * 等用户从 Three.js 现成案例中选定参考后重建。
 */
export default function Home() {
  return (
    <main className="flex h-screen w-screen flex-col items-center justify-center gap-6">
      <h1 className="text-glow text-3xl font-semibold tracking-[0.3em] text-lr-accent">长河</h1>
      <p className="text-sm tracking-widest text-lr-muted">视觉方向待定 —— 等待选定的参考案例</p>
      <ThemeToggle />
    </main>
  );
}
