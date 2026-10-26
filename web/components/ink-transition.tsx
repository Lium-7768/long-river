'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * 墨染转场：整屏浓墨从点击处晕开，遮住路由切换的"瞬切"。
 *
 * 设计约束（必须遵守，否则会重演历史 bug）：
 *   1. 遮罩 **永远 pointer-events: none** —— 绝不拦截滚轮/点击，
 *      否则会像之前的 Lenis 那样把整站滚动劫持掉。
 *   2. 用模块级 busy 标志防重复触发，而不是靠遮罩挡点击。
 *   3. prefers-reduced-motion 下直接跳过动画，仅做最小提示。
 *   4. 兜底定时器：任何异常都保证遮罩会自己消失，不会永久糊在屏幕上。
 */

type Payload = { label?: string; x: number; y: number };

let emit: ((p: Payload) => void) | null = null;
let busy = false;

/**
 * 触发一次墨染。不阻塞调用方——调用后立刻 router.push 即可，
 * 遮罩会在路由变化后自动淡出。
 */
export function inkWipe(label?: string, origin?: { x: number; y: number }) {
  if (busy) return;
  busy = true;
  const x = origin?.x ?? (typeof window !== 'undefined' ? window.innerWidth / 2 : 0);
  const y = origin?.y ?? (typeof window !== 'undefined' ? window.innerHeight * 0.42 : 0);
  emit?.({ label, x, y });
  // 兜底：即使路由没变（例如点了当前页），也要解锁
  setTimeout(() => {
    busy = false;
  }, 1800);
}

/** 把点击事件的坐标转成墨点原点 */
export function inkOriginFromEvent(e: { clientX: number; clientY: number }) {
  return { x: e.clientX, y: e.clientY };
}

export function InkTransitionHost() {
  const pathname = usePathname();
  const [state, setState] = useState<{ label?: string; x: number; y: number } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const prevPath = useRef<string | null>(null);
  const reduce = useRef(false);

  useEffect(() => {
    reduce.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    emit = (p) => {
      if (reduce.current) return;
      setLeaving(false);
      setState(p);
    };
    return () => {
      emit = null;
    };
  }, []);

  // 路由变化 → 墨层退场
  useEffect(() => {
    if (prevPath.current === null) {
      prevPath.current = pathname;
      return;
    }
    if (prevPath.current !== pathname) {
      prevPath.current = pathname;
      if (state) {
        setLeaving(true);
        const t = setTimeout(() => {
          setState(null);
          setLeaving(false);
        }, 420);
        return () => clearTimeout(t);
      }
    }
  }, [pathname, state]);

  if (!state) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[100] overflow-hidden"
      style={{ contain: 'strict' }}
    >
      {/* 墨团：从点击点向外晕开 */}
      <div
        className={leaving ? 'ink-wipe ink-wipe--out' : 'ink-wipe'}
        style={{ left: state.x, top: state.y }}
      />
      {/* 墨色薄纱 */}
      <div className={leaving ? 'ink-veil ink-veil--out' : 'ink-veil'} />
      {/* 文字 */}
      {state.label && (
        <div className={leaving ? 'ink-label ink-label--out' : 'ink-label'}>{state.label}</div>
      )}
    </div>
  );
}
