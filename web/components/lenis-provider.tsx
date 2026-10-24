'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Lenis from 'lenis';

/**
 * Lenis 只在 L1（/）启用。
 * L1 是全屏 100vh Canvas，滚轮用于驱动相机（RiverExperience 已接管 wheel），
 * Lenis 在 L1 上提供平滑惯性；在 /dynasty/* 等可滚动页则完全不介入，
 * 否则会在 transform 容器里劫持 wheel，导致朝代页无法滚动。
 */
export function LenisProvider() {
  const pathname = usePathname();
  const lenisRef = useRef<Lenis | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const isL1 = pathname === '/';
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!isL1 || media.matches) {
      // 非 L1 或用户偏好减少动效：确保原生滚动不受 Lenis 影响
      document.documentElement.classList.remove('lenis', 'lenis-smooth');
      if (lenisRef.current) {
        lenisRef.current.destroy();
        lenisRef.current = null;
      }
      cancelAnimationFrame(rafRef.current);
      return;
    }

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t: number) => 1 - Math.pow(1 - t, 3),
      smoothWheel: true,
      touchMultiplier: 1.6,
      autoRaf: false,
    });
    lenisRef.current = lenis;

    const onFrame = (time: number) => {
      lenis.raf(time);
      rafRef.current = requestAnimationFrame(onFrame);
    };
    rafRef.current = requestAnimationFrame(onFrame);

    return () => {
      cancelAnimationFrame(rafRef.current);
      lenis.destroy();
      if (lenisRef.current === lenis) lenisRef.current = null;
      document.documentElement.classList.remove('lenis', 'lenis-smooth');
    };
  }, [pathname]);

  return null;
}
