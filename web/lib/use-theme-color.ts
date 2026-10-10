'use client';

import { useEffect, useMemo, useState } from 'react';
import { cssRgb, type RGB } from './theme';

/**
 * 把 CSS 变量绑定为 React 状态。
 * 主题切换（lr-theme-change 事件）时自动重新读取，
 * 从而让 Three.js 材质颜色跟随主题变化。
 */
export function useThemeColor(varName: string, fallback: RGB = [1, 1, 1]): RGB {
  const [rgb, setRgb] = useState<RGB>(fallback);

  useEffect(() => {
    const read = () => setRgb(cssRgb(varName));
    read();
    window.addEventListener('lr-theme-change', read);
    return () => window.removeEventListener('lr-theme-change', read);
  }, [varName]);

  return rgb;
}

/** 一次性读取多个主题色（varNames 变化时重订阅） */
export function useThemeColors(varNames: string[]): RGB[] {
  const key = useMemo(() => varNames.join('|'), [varNames]);
  const [rgb, setRgb] = useState<RGB[]>(() => varNames.map(() => [1, 1, 1] as RGB));

  useEffect(() => {
    const names = key ? key.split('|') : [];
    const read = () => setRgb(names.map((n) => cssRgb(n)));
    read();
    window.addEventListener('lr-theme-change', read);
    return () => window.removeEventListener('lr-theme-change', read);
  }, [key]);

  return rgb;
}
