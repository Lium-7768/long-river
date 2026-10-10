import * as THREE from 'three';

/**
 * 生成"星空顶"用的柔和圆形光点贴图。
 * PointsMaterial 默认把点画成正方形 —— 这就是用户看到方块的原因。
 * 用一张径向渐变的圆形贴图 + alphaMap，让每个点变成"中心亮、边缘柔化"的圆光点。
 */
let cached: THREE.Texture | null = null;

export function getStarTexture(size = 128): THREE.Texture {
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  // 中心实白 → 中段渐隐 → 边缘全透明
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.38, 'rgba(255,255,255,0.42)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.08)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  cached = tex;
  return tex;
}

/**
 * 更"硬"一点的星核：用于银河里的小亮点，边界更清晰但仍带柔化。
 */
let cachedTight: THREE.Texture | null = null;
export function getStarTextureTight(size = 64): THREE.Texture {
  if (cachedTight) return cachedTight;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.78, 'rgba(255,255,255,0.25)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  cachedTight = tex;
  return tex;
}
