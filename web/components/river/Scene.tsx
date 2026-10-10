'use client';

import { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { DYNASTIES, DYNASTIES_WITH_DATA } from '@/content/dynasties';
import { riverCurve, DYNASTY_T, pointAt } from './curve';
import { computeCamera, type CameraMode } from './cameraModes';
import { useThemeColor } from '@/lib/use-theme-color';

/**
 * 滚动驱动的时间长河。
 * 相机沿 riverCurve 飞行，progress∈[0,1] 由外部滚动控制（用 ref 传入，避免重渲染）。
 */

const hasData = (id: string) => DYNASTIES_WITH_DATA.has(id);

/* ---------- 河道：沿曲线的一串光带 + 粒子 ---------- */
function RiverRibbon() {
  const accent = useThemeColor('--lr-accent', [0.15, 0.7, 1]);

  const { lineGeom, particleGeom } = useMemo(() => {
    const N = 240;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= N; i++) pts.push(riverCurve.getPointAt(i / N));
    const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);

    // 河道两侧的浮尘
    const count = 2400;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const t = Math.random();
      const p = riverCurve.getPointAt(t);
      const spread = 3.5;
      arr[i * 3] = p.x + (Math.random() - 0.5) * spread;
      arr[i * 3 + 1] = p.y + (Math.random() - 0.5) * 1.2;
      arr[i * 3 + 2] = p.z + (Math.random() - 0.5) * spread;
    }
    const particleGeom = new THREE.BufferGeometry();
    particleGeom.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return { lineGeom, particleGeom };
  }, []);

  const lineObj = useMemo(() => {
    const mat = new THREE.LineBasicMaterial({
      color: new THREE.Color(accent[0], accent[1], accent[2]),
      transparent: true,
      opacity: 0.4,
      toneMapped: false,
    });
    return new THREE.Line(lineGeom, mat);
  }, [lineGeom, accent]);

  useFrame(({ clock }) => {
    const m = lineObj.material as THREE.LineBasicMaterial;
    m.opacity = 0.35 + Math.sin(clock.elapsedTime * 1.5) * 0.12;
  });

  return (
    <group>
      <primitive object={lineObj} />
      <points geometry={particleGeom}>
        <pointsMaterial
          size={0.05}
          color={new THREE.Color(accent[0], accent[1], accent[2])}
          transparent
          opacity={0.55}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation
          toneMapped={false}
        />
      </points>
    </group>
  );
}

/* ---------- 星空 + 银河 ---------- */
function Starfield() {
  const accent = useThemeColor('--lr-accent', [0.15, 0.7, 1]);
  const accent2 = useThemeColor('--lr-accent-2', [0.5, 0.35, 1]);

  // 1) 远景球壳星（不受雾影响）
  const farGeom = useMemo(() => {
    const count = 4000;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      let x, y, z, r;
      do {
        x = Math.random() * 2 - 1;
        y = Math.random() * 2 - 1;
        z = Math.random() * 2 - 1;
        r = Math.hypot(x, y, z);
      } while (r > 1 || r < 0.3);
      const nx = x / r,
        ny = y / r,
        nz = z / r;
      const R = 90 + Math.random() * 50;
      pos[i * 3] = nx * R;
      pos[i * 3 + 1] = ny * R;
      pos[i * 3 + 2] = nz * R - 30;
      const c = new THREE.Color(0.7, 0.78, 1).offsetHSL(
        (Math.random() - 0.5) * 0.2,
        0,
        (Math.random() - 0.5) * 0.3,
      );
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }, []);

  // 2) 银河带：一条斜跨天空的密集星云带
  const galaxyGeom = useMemo(() => {
    const count = 6000;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const c1 = new THREE.Color(accent2[0], accent2[1], accent2[2]);
    const c2 = new THREE.Color(0.6, 0.85, 1);
    for (let i = 0; i < count; i++) {
      // 沿一条大圆弧分布，垂直于弧线方向做高斯扩散
      const t = Math.random() * Math.PI * 2;
      const spread = Math.random() - 0.5;
      const gauss = spread * Math.abs(spread) * 2; // 中间密两边疏
      const R = 120 + Math.random() * 30;
      // 银河平面：绕 X 轴倾斜 60°
      const u = Math.cos(t),
        v = Math.sin(t);
      const band = gauss * 26;
      pos[i * 3] = u * R + band * 0.2;
      pos[i * 3 + 1] = v * Math.sin(1.05) * R + band;
      pos[i * 3 + 2] = v * Math.cos(1.05) * R - 30;
      const c = c1.clone().lerp(c2, Math.random());
      const dim = 0.4 + Math.random() * 0.6;
      col[i * 3] = c.r * dim;
      col[i * 3 + 1] = c.g * dim;
      col[i * 3 + 2] = c.b * dim;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }, [accent2]);

  // 3) 近景星（可动，带一点主题色）
  const nearGeom = useMemo(() => {
    const count = 900;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      let x, y, z, r;
      do {
        x = Math.random() * 2 - 1;
        y = Math.random() * 2 - 1;
        z = Math.random() * 2 - 1;
        r = Math.hypot(x, y, z);
      } while (r > 1 || r < 0.3);
      const R = 45 + Math.random() * 25;
      pos[i * 3] = (x / r) * R;
      pos[i * 3 + 1] = (y / r) * R * 0.6 + 3;
      pos[i * 3 + 2] = (z / r) * R * 2.2 - 30;
      const c = new THREE.Color(accent[0], accent[1], accent[2]).offsetHSL(
        (Math.random() - 0.5) * 0.1,
        0,
        (Math.random() - 0.5) * 0.3,
      );
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }, [accent]);

  const far = useRef<THREE.Points>(null);
  const gal = useRef<THREE.Points>(null);
  const near = useRef<THREE.Points>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (far.current) far.current.rotation.y = t * 0.004;
    if (gal.current) gal.current.rotation.y = t * 0.003;
    if (near.current) near.current.rotation.y = -t * 0.01;
  });

  return (
    <group>
      {/* 银河带（不受雾影响，加色混合） */}
      <points ref={gal} geometry={galaxyGeom} frustumCulled={false}>
        <pointsMaterial
          size={0.9}
          vertexColors
          transparent
          opacity={0.7}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
          depthWrite={false}
          toneMapped={false}
          fog={false}
        />
      </points>
      {/* 远景星 */}
      <points ref={far} geometry={farGeom} frustumCulled={false}>
        <pointsMaterial
          size={0.7}
          vertexColors
          transparent
          opacity={0.95}
          sizeAttenuation
          depthWrite={false}
          toneMapped={false}
          fog={false}
        />
      </points>
      {/* 近景星 */}
      <points ref={near} geometry={nearGeom} frustumCulled={false}>
        <pointsMaterial
          size={0.5}
          vertexColors
          transparent
          opacity={0.7}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
          depthWrite={false}
          toneMapped={false}
          fog={false}
        />
      </points>
    </group>
  );
}

/* ---------- 单个朝代节点 ---------- */
function DynastyNode({ index, onPick }: { index: number; onPick: (i: number) => void }) {
  const d = DYNASTIES[index];
  const usable = hasData(d.id);
  const accent = useThemeColor('--lr-accent', [0.15, 0.7, 1]);
  const accent2 = useThemeColor('--lr-accent-2', [0.5, 0.35, 1]);
  const [hover, setHover] = useState(false);
  const g = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);

  const t = DYNASTY_T[index];
  const base = useMemo(() => pointAt(t), [t]);

  const textRef = useRef<THREE.Group>(null);
  const col = usable ? accent : [0.35, 0.42, 0.55];
  const color = new THREE.Color(col[0], col[1], col[2]);

  useFrame(({ clock, camera }) => {
    if (g.current) g.current.rotation.y = Math.sin(clock.elapsedTime * 0.5 + index) * 0.15;
    if (ring.current) ring.current.rotation.z = clock.elapsedTime * (usable ? 0.6 : 0.15);
    // 文字始终面向相机（billboard），保证任何角度都可读、不倒
    if (textRef.current) textRef.current.quaternion.copy(camera.quaternion);
  });

  return (
    <group position={base}>
      <group ref={g}>
        {/* 主碑：细高的晶体 */}
        <mesh
          position={[0, usable ? 0.9 : 0.4, 0]}
          onPointerOver={(e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation();
            setHover(true);
            document.body.style.cursor = usable ? 'pointer' : 'default';
          }}
          onPointerOut={() => {
            setHover(false);
            document.body.style.cursor = 'default';
          }}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            if (usable) onPick(index);
          }}
        >
          <octahedronGeometry args={[usable ? 0.55 : 0.3, 0]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={usable ? (hover ? 1.4 : 0.6) : 0.1}
            roughness={0.15}
            metalness={0.7}
            toneMapped={false}
          />
        </mesh>
        {/* 旋转光环 */}
        <mesh ref={ring} position={[0, usable ? 0.9 : 0.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[usable ? 0.9 : 0.5, 0.02, 8, 48]} />
          <meshBasicMaterial
            color={new THREE.Color(accent2[0], accent2[1], accent2[2])}
            transparent
            opacity={usable ? 0.6 : 0.15}
            toneMapped={false}
          />
        </mesh>
      </group>
      {/* 名字（billboard，始终面向相机） */}
      <group ref={textRef}>
        <Text
          position={[0, usable ? 1.95 : 1.15, 0]}
          fontSize={0.42}
          color={usable ? '#eaf6ff' : '#5e6f88'}
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.008}
          outlineColor="#03060f"
        >
          {d.name}
        </Text>
        <Text
          position={[0, usable ? -0.45 : -0.3, 0]}
          fontSize={0.2}
          color="#7b8aa8"
          anchorX="center"
          anchorY="top"
          outlineWidth={0.006}
          outlineColor="#03060f"
        >
          {`${d.start < 0 ? '前' + -d.start : d.start}`}
        </Text>
      </group>
    </group>
  );
}

/* ---------- 相机飞行（核心）---------- */
function CameraRig({
  progress,
  mode,
}: {
  progress: React.MutableRefObject<number>;
  mode: CameraMode;
}) {
  const { camera } = useThree();
  const lookAt = useRef(new THREE.Vector3());
  const pos = useRef(new THREE.Vector3());
  const mouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  const tmp = useRef({ pos: new THREE.Vector3(), look: new THREE.Vector3() });

  useFrame((_, dt) => {
    const t = THREE.MathUtils.clamp(progress.current, 0, 1);
    computeCamera(mode, t, mouse.current, tmp.current);

    // 缓动（惯性）
    const k = 1 - Math.exp(-6 * dt);
    pos.current.lerp(tmp.current.pos, k);
    lookAt.current.lerp(tmp.current.look, k);
    camera.position.copy(pos.current);
    camera.lookAt(lookAt.current);
  });

  return null;
}

export function Scene({
  progress,
  mode,
  onPick,
}: {
  progress: React.MutableRefObject<number>;
  mode: CameraMode;
  onPick: (i: number) => void;
}) {
  return (
    <>
      <color attach="background" args={['#03060f']} />
      <fog attach="fog" args={['#03060f', 30, 95]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[5, 10, 5]} intensity={0.7} />
      <Starfield />
      <RiverRibbon />
      {DYNASTIES.map((_, i) => (
        <DynastyNode key={i} index={i} onPick={onPick} />
      ))}
      <CameraRig progress={progress} mode={mode} />
    </>
  );
}
