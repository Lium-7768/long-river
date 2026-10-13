'use client';

import { useEffect, useState } from 'react';

let _cached: boolean | null = null;

/**
 * 检测当前环境是否支持 WebGL。
 * 结果模块级缓存（同一会话只探测一次）。
 * 用于 3D 组件的优雅降级：无 WebGL 时渲染 2D 回退，而不是整页崩溃。
 */
export function detectWebGL(): boolean {
  if (_cached !== null) return _cached;
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    _cached = !!gl;
    // 释放上下文
    if (gl && 'getExtension' in gl) {
      const lose = (gl as WebGLRenderingContext).getExtension('WEBGL_lose_context');
      lose?.loseContext();
    }
  } catch {
    _cached = false;
  }
  return _cached;
}

/** React hook：返回是否可用 WebGL（首帧为 null＝未探测）*/
export function useWebGLAvailable(): boolean | null {
  const [ok, setOk] = useState<boolean | null>(_cached);
  useEffect(() => {
    setOk(detectWebGL());
  }, []);
  return ok;
}
