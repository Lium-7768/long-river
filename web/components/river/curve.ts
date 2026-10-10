import * as THREE from 'three';
import { DYNASTIES } from '@/content/dynasties';

/**
 * 河道曲线：朝代沿一条 CatmullRom 曲线分布，相机沿它飞行。
 * 参考 Codrops《Emotional Experiences》的 cameraCurve 手法。
 *
 * 形状：一条缓缓起伏、蜿蜒向前的"河"。起点→终点横跨时间全跨度。
 * 每个朝代在曲线上有一个 t∈[0,1] 参数位置。
 */

// 手工调的控制点：一条向前(S型蜿蜒)、略带起伏的路径
const CONTROL: [number, number, number][] = [
  [0, 0, 0],
  [4, 0.6, -8],
  [-3, -0.4, -16],
  [3, 0.8, -25],
  [-4, -0.2, -34],
  [2, 1.0, -43],
  [-2, 0.3, -52],
  [0, 0.6, -62],
];

export const riverCurve = new THREE.CatmullRomCurve3(
  CONTROL.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
  false,
  'catmullrom',
  0.5,
);

/** 每个朝代在曲线上的参数位置（等距，而非按年数——解决秦朝不可见问题） */
export const DYNASTY_T = DYNASTIES.map((_, i) =>
  DYNASTIES.length > 1 ? i / (DYNASTIES.length - 1) : 0,
);

/** 取曲线上 t 处的点 */
export function pointAt(t: number): THREE.Vector3 {
  return riverCurve.getPointAt(THREE.MathUtils.clamp(t, 0, 1));
}
