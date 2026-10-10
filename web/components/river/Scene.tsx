'use client';

import { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { DYNASTIES, DYNASTIES_WITH_DATA } from '@/content/dynasties';
import { riverCurve, DYNASTY_T, pointAt } from './curve';
import { fmtYear } from './year';
import { computeCamera, type CameraMode } from './cameraModes';
import { getStarTexture, getStarTextureTight } from './starTexture';
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
          size={0.16}
          map={getStarTexture()}
          color={new THREE.Color(accent[0], accent[1], accent[2])}
          transparent
          opacity={0.7}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation
          toneMapped={false}
        />
      </points>
    </group>
  );
}

/* ---------- 星空 ---------- */
function Starfield() {
  const accent = useThemeColor('--lr-accent', [0.15, 0.7, 1]);

  // 1) 远景球壳星：大小/明暗分级 + 星色（真实星空调色板）
  const farGeom = useMemo(() => {
    const count = 4500;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    // 真实星空星色：蓝白 / 纯白 / 微黄 / 微橙 / 微红
    const palette = [
      new THREE.Color(0.75, 0.85, 1.0), // 蓝白（热）
      new THREE.Color(1.0, 1.0, 1.0), // 纯白
      new THREE.Color(1.0, 0.97, 0.85), // 微黄
      new THREE.Color(1.0, 0.9, 0.72), // 橙
      new THREE.Color(1.0, 0.82, 0.78), // 微红（冷巨星）
    ];
    for (let i = 0; i < count; i++) {
      let x, y, z, r;
      do {
        x = Math.random() * 2 - 1;
        y = Math.random() * 2 - 1;
        z = Math.random() * 2 - 1;
        r = Math.hypot(x, y, z);
      } while (r > 1 || r < 0.3);
      const R = 90 + Math.random() * 50;
      pos[i * 3] = (x / r) * R;
      pos[i * 3 + 1] = (y / r) * R;
      pos[i * 3 + 2] = (z / r) * R - 30;
      // 星等：多数暗、少数亮（幂律）——用 pow 让大的少
      const mag = Math.pow(Math.random(), 2.5); // 0..1，偏 0
      const base = palette[Math.floor(Math.random() * palette.length)];
      const bright = 0.35 + mag * 0.75;
      col[i * 3] = base.r * bright;
      col[i * 3 + 1] = base.g * bright;
      col[i * 3 + 2] = base.b * bright;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }, []);

  // 3) 近景星：更亮更大，带主题色 + 星色
  const nearGeom = useMemo(() => {
    const count = 1100;
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
      const mag = Math.pow(Math.random(), 2);
      const c =
        Math.random() < 0.6
          ? new THREE.Color(0.8, 0.88, 1.0)
          : new THREE.Color(accent[0], accent[1], accent[2]);
      const bright = 0.4 + mag * 0.7;
      col[i * 3] = c.r * bright;
      col[i * 3 + 1] = c.g * bright;
      col[i * 3 + 2] = c.b * bright;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }, [accent]);

  const far = useRef<THREE.Points>(null);
  const near = useRef<THREE.Points>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (far.current) far.current.rotation.y = t * 0.004;
    if (near.current) near.current.rotation.y = -t * 0.01;
  });

  return (
    <group>
      {/* 远景星：暗小星（多数） */}
      <points ref={far} geometry={farGeom} frustumCulled={false}>
        <pointsMaterial
          size={0.7}
          map={getStarTexture()}
          vertexColors
          transparent
          opacity={0.7}
          sizeAttenuation
          depthWrite={false}
          toneMapped={false}
          fog={false}
        />
      </points>
      {/* 远景星：亮大星（少数，同一批几何但用大尺寸叠加出"亮星"） */}
      <points geometry={farGeom} frustumCulled={false}>
        <pointsMaterial
          size={1.6}
          map={getStarTexture()}
          vertexColors
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
          depthWrite={false}
          toneMapped={false}
          fog={false}
        />
      </points>
      {/* 近景星 */}
      <points ref={near} geometry={nearGeom} frustumCulled={false}>
        <pointsMaterial
          size={0.9}
          map={getStarTexture()}
          vertexColors
          transparent
          opacity={0.8}
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

/* ---------- 单个朝代节点：光点 + 光晕（极简） ---------- */
function DynastyNode({ index, onPick }: { index: number; onPick: (i: number) => void }) {
  const d = DYNASTIES[index];
  const usable = hasData(d.id);
  const accent = useThemeColor('--lr-accent', [0.15, 0.7, 1]);
  const accent2 = useThemeColor('--lr-accent-2', [0.5, 0.35, 1]);
  const [hover, setHover] = useState(false);

  const coreRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const halo2Ref = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Sprite>(null);
  const textRef = useRef<THREE.Group>(null);
  const dustRef = useRef<THREE.Points>(null);

  const t = DYNASTY_T[index];
  const base = useMemo(() => pointAt(t), [t]);
  const col = usable ? accent : [0.4, 0.46, 0.58];
  const color = new THREE.Color(col[0], col[1], col[2]);
  const color2 = new THREE.Color(accent2[0], accent2[1], accent2[2]);
  const y = usable ? 1.1 : 0.6;
  const R = usable ? 0.16 : 0.1;

  // 周围漂浮的尘埃微粒
  const dustGeom = useMemo(() => {
    const count = usable ? 60 : 14;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const b = Math.acos(Math.random() * 2 - 1);
      const r = (usable ? 0.7 : 0.4) + Math.random() * (usable ? 1.2 : 0.5);
      pos[i * 3] = Math.sin(b) * Math.cos(a) * r;
      pos[i * 3 + 1] = Math.cos(b) * r + y;
      pos[i * 3 + 2] = Math.sin(b) * Math.sin(a) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, [usable, y]);

  useFrame(({ clock, camera }) => {
    const t0 = clock.elapsedTime;
    // 核心光球：轻微脉冲
    if (coreRef.current) {
      const sc = 1 + Math.sin(t0 * 2 + index) * 0.15 + (hover ? 0.6 : 0);
      coreRef.current.scale.setScalar(sc);
    }
    // 光晕缓慢扩张淡出（呼吸）
    if (haloRef.current) {
      const k = (t0 * 0.35 + index * 0.5) % 1; // 0..1 循环
      const sc = 1 + k * (usable ? 2.6 : 1.5);
      haloRef.current.scale.setScalar(sc);
      const m = haloRef.current.material as THREE.MeshBasicMaterial;
      m.opacity = (1 - k) * (usable ? 0.45 : 0.12);
    }
    if (halo2Ref.current) {
      const k = (((t0 * 0.35 + index * 0.5) % 1) + 0.5) % 1;
      const sc = 1 + k * (usable ? 2.6 : 1.5);
      halo2Ref.current.scale.setScalar(sc);
      const m = halo2Ref.current.material as THREE.MeshBasicMaterial;
      m.opacity = (1 - k) * (usable ? 0.45 : 0.12);
    }
    // 外围柔光 Sprite 面向相机
    if (glowRef.current) {
      const m = glowRef.current.material as THREE.SpriteMaterial;
      m.opacity = usable ? (hover ? 0.95 : 0.7) : 0.15;
      m.rotation = t0 * 0.1;
    }
    if (dustRef.current) dustRef.current.rotation.y = t0 * 0.2 + index;
    if (textRef.current) textRef.current.quaternion.copy(camera.quaternion);
  });

  return (
    <group position={base}>
      <group
        position={[0, y, 0]}
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
        {/* 核心光球 */}
        <mesh ref={coreRef}>
          <sphereGeometry args={[R, 24, 24]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>

        {/* 外围柔光（用星空贴图做 Sprite，始终面向相机） */}
        <sprite ref={glowRef} scale={[usable ? 2.4 : 1.2, usable ? 2.4 : 1.2, 1]}>
          <spriteMaterial
            map={getStarTexture()}
            color={color}
            transparent
            opacity={usable ? 0.7 : 0.15}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>

        {/* 扩散光晕环 1 */}
        <mesh ref={haloRef} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[R * 1.5, R * 1.75, 48]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.4}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        {/* 扩散光晕环 2（错相位） */}
        <mesh ref={halo2Ref} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[R * 1.5, R * 1.75, 48]} />
          <meshBasicMaterial
            color={color2}
            transparent
            opacity={0.4}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>

        {/* 尘埃微粒 */}
        <points ref={dustRef} geometry={dustGeom}>
          <pointsMaterial
            size={0.09}
            map={getStarTextureTight()}
            color={color}
            transparent
            opacity={usable ? 0.85 : 0.25}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            sizeAttenuation
            toneMapped={false}
          />
        </points>
      </group>

      {/* 名字（billboard） */}
      <group ref={textRef}>
        <Text
          position={[0, y + R + (usable ? 0.95 : 0.6), 0]}
          fontSize={usable ? 0.5 : 0.34}
          color={usable ? '#eaf6ff' : '#5e6f88'}
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.01}
          outlineColor="#03060f"
        >
          {d.name}
        </Text>
        <Text
          position={[0, y - R - (usable ? 0.7 : 0.45), 0]}
          fontSize={0.22}
          color="#8fa6c4"
          anchorX="center"
          anchorY="top"
          outlineWidth={0.008}
          outlineColor="#03060f"
        >
          {fmtYear(d.start)}
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
      <EffectComposer multisampling={0}>
        <Bloom
          intensity={1.1}
          luminanceThreshold={0.35}
          luminanceSmoothing={0.4}
          mipmapBlur
          radius={0.75}
        />
        <Vignette eskil={false} offset={0.32} darkness={0.78} />
      </EffectComposer>
    </>
  );
}
