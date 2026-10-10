import * as THREE from 'three';
import { pointAt } from './curve';

export type CameraMode = 'fly' | 'side';

/**
 * 两种视角：
 * - fly  ：沿河飞行（当前）。朝代迎面而来，沉浸、有推进感。
 * - side ：侧上方俯瞰，整条河像一条飘带横在眼前，能看到前后朝代。
 */
export function computeCamera(
  mode: CameraMode,
  progress: number,
  mouse: { x: number; y: number },
  out: { pos: THREE.Vector3; look: THREE.Vector3 },
) {
  if (mode === 'fly') {
    const p = pointAt(progress);
    const ahead = pointAt(Math.min(progress + 0.06, 1));
    out.pos.set(p.x + mouse.x * 1.4, p.y + 1.6 - mouse.y * 0.6, p.z + 3.2);
    out.look.set(ahead.x, ahead.y + 0.6, ahead.z);
  } else {
    // side：固定在河侧上方，跟随 progress 缓慢平移，看向当段河道
    const p = pointAt(progress);
    const look = pointAt(Math.min(progress + 0.14, 1));
    out.pos.set(p.x + 9 + mouse.x * 1.6, p.y + 4.5 - mouse.y * 1.2, p.z + 5);
    out.look.set(look.x, look.y + 0.4, look.z);
  }
}
