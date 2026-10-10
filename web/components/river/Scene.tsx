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

/* ---------- 星空 + 银河 ---------- */
function Starfield() {
  const accent = useThemeColor('--lr-accent', [0.15, 0.7, 1]);
  const accent2 = useThemeColor('--lr-accent-2', [0.5, 0.35, 1]);

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
  // 银河：一条斜跨天空的弥散光带（单条！）
  // 主轴 = 一条直线（倾斜），垂直方向高斯扩散 → 中心浓、两侧淡
  const galaxyGeom = useMemo(() => {
    const count = 14000;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const cCore = new THREE.Color(0.85, 0.9, 1.0); // 银心偏暖白
    const cEdge = new THREE.Color(accent2[0], accent2[1], accent2[2]);
    const cCool = new THREE.Color(accent[0], accent[1], accent[2]);

    // 主轴：一条横跨天空的斜带（左上→右下）
    const axis = new THREE.Vector3(1, -0.5, -0.35).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const side = new THREE.Vector3().crossVectors(axis, up).normalize();
    const side2 = new THREE.Vector3().crossVectors(axis, side).normalize();
    // 放到很远的天幕背景（相机不会飞进去）
    const center = new THREE.Vector3(-20, 26, -95);

    for (let i = 0; i < count; i++) {
      // 沿主轴均匀铺开
      const along = (Math.random() - 0.5) * 240;
      // 垂直扩散：高斯（两三个随机数之和≈高斯）
      const g1 = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
      const g2 = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
      const width = 14;
      const p = center
        .clone()
        .addScaledVector(axis, along)
        .addScaledVector(side, g1 * width)
        .addScaledVector(side2, g2 * width * 0.5);
      pos[i * 3] = p.x;
      pos[i * 3 + 1] = p.y;
      pos[i * 3 + 2] = p.z;

      // 颜色：越靠中心越暖白，越靠边缘越冷/主题色
      const dist = Math.hypot(g1, g2);
      const c = cCore.clone().lerp(dist > 0.6 ? cEdge : cCool, Math.min(dist, 1));
      const dim = 0.35 + Math.random() * 0.65;
      col[i * 3] = c.r * dim;
      col[i * 3 + 1] = c.g * dim;
      col[i * 3 + 2] = c.b * dim;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }, [accent, accent2]);

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
      {/* 银河带：双层（柔光晕 + 亮核），圆形贴图 */}
      <points ref={gal} geometry={galaxyGeom} frustumCulled={false}>
        <pointsMaterial
          size={3.2}
          map={getStarTexture()}
          vertexColors
          transparent
          opacity={0.5}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
          depthWrite={false}
          toneMapped={false}
          fog={false}
        />
      </points>
      <points geometry={galaxyGeom} frustumCulled={false}>
        <pointsMaterial
          size={1.2}
          map={getStarTextureTight()}
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

/* ---------- 单个朝代节点：能量晶体 ---------- */
function DynastyNode({ index, onPick }: { index: number; onPick: (i: number) => void }) {
  const d = DYNASTIES[index];
  const usable = hasData(d.id);
  const accent = useThemeColor('--lr-accent', [0.15, 0.7, 1]);
  const accent2 = useThemeColor('--lr-accent-2', [0.5, 0.35, 1]);
  const [hover, setHover] = useState(false);

  const coreRef = useRef<THREE.Mesh>(null);
  const shellRef = useRef<THREE.Mesh>(null);
  const ringARef = useRef<THREE.Mesh>(null);
  const ringBRef = useRef<THREE.Mesh>(null);
  const beamRef = useRef<THREE.Mesh>(null);
  const textRef = useRef<THREE.Group>(null);
  const sparkRef = useRef<THREE.Points>(null);

  const t = DYNASTY_T[index];
  const base = useMemo(() => pointAt(t), [t]);
  const col = usable ? accent : [0.35, 0.42, 0.55];
  const color = new THREE.Color(col[0], col[1], col[2]);
  const color2 = new THREE.Color(accent2[0], accent2[1], accent2[2]);
  const yNode = usable ? 1.0 : 0.5;
  const R = usable ? 0.55 : 0.3;

  // 晶体周围的发光微粒
  const sparkGeom = useMemo(() => {
    const count = usable ? 90 : 20;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const b = Math.acos(Math.random() * 2 - 1);
      const r = R * (1.6 + Math.random() * 1.8);
      pos[i * 3] = Math.sin(b) * Math.cos(a) * r;
      pos[i * 3 + 1] = Math.cos(b) * r + yNode;
      pos[i * 3 + 2] = Math.sin(b) * Math.sin(a) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, [R, yNode, usable]);

  useFrame(({ clock, camera }) => {
    const t0 = clock.elapsedTime;
    const pulse = usable ? 1 + Math.sin(t0 * 2 + index) * 0.12 : 1;
    // 核心晶体：缓慢自转 + 脉冲缩放
    if (coreRef.current) {
      coreRef.current.rotation.y = t0 * (usable ? 0.5 : 0.1) + index;
      coreRef.current.rotation.x = Math.sin(t0 * 0.4 + index) * 0.3;
      coreRef.current.scale.setScalar(pulse);
    }
    // 外层线框壳反向转
    if (shellRef.current) {
      shellRef.current.rotation.y = -t0 * (usable ? 0.3 : 0.08) - index;
      shellRef.current.rotation.z = t0 * 0.2;
    }
    // 两个环：不同倾角、不同转速
    if (ringARef.current) {
      ringARef.current.rotation.z = t0 * (usable ? 0.7 : 0.15);
      ringARef.current.rotation.x = Math.PI / 2.4;
    }
    if (ringBRef.current) {
      ringBRef.current.rotation.z = -t0 * (usable ? 0.5 : 0.1);
      ringBRef.current.rotation.x = Math.PI / 1.6;
      ringBRef.current.rotation.y = t0 * 0.3;
    }
    // 光柱呼吸
    if (beamRef.current) {
      const m = beamRef.current.material as THREE.MeshBasicMaterial;
      m.opacity = (usable ? 0.28 : 0.08) * (0.7 + Math.sin(t0 * 2.2 + index) * 0.3);
    }
    // 微粒旋转
    if (sparkRef.current) sparkRef.current.rotation.y = t0 * 0.25 + index;
    // 文字面向相机
    if (textRef.current) textRef.current.quaternion.copy(camera.quaternion);
  });

  return (
    <group position={base}>
      {/* 向下光柱：连到河面 */}
      <mesh ref={beamRef} position={[0, yNode / 2, 0]}>
        <cylinderGeometry args={[R * 0.28, R * 0.9, yNode, 16, 1, true]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={usable ? 0.28 : 0.08}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* 可交互主晶体（含外层线框 + 内发光核心） */}
      <group
        position={[0, yNode, 0]}
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
        {/* 内发光核心 */}
        <mesh ref={coreRef}>
          <octahedronGeometry args={[R, 0]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={usable ? (hover ? 2.2 : 1.1) : 0.15}
            roughness={0.1}
            metalness={0.9}
            toneMapped={false}
          />
        </mesh>
        {/* 外层线框壳 */}
        <mesh ref={shellRef}>
          <octahedronGeometry args={[R * 1.5, 0]} />
          <meshBasicMaterial
            color={color2}
            wireframe
            transparent
            opacity={usable ? 0.5 : 0.12}
            toneMapped={false}
          />
        </mesh>
        {/* 环 A */}
        <mesh ref={ringARef}>
          <torusGeometry args={[R * 1.9, 0.018, 8, 64]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={usable ? 0.85 : 0.2}
            toneMapped={false}
          />
        </mesh>
        {/* 环 B */}
        <mesh ref={ringBRef}>
          <torusGeometry args={[R * 2.35, 0.012, 8, 64]} />
          <meshBasicMaterial
            color={color2}
            transparent
            opacity={usable ? 0.6 : 0.15}
            toneMapped={false}
          />
        </mesh>
        {/* 微粒 */}
        <points ref={sparkRef} geometry={sparkGeom}>
          <pointsMaterial
            size={0.12}
            map={getStarTextureTight()}
            color={color}
            transparent
            opacity={usable ? 0.9 : 0.3}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            sizeAttenuation
            toneMapped={false}
          />
        </points>
      </group>

      {/* 名字（billboard，始终面向相机） */}
      <group ref={textRef}>
        <Text
          position={[0, yNode + R + 0.85, 0]}
          fontSize={usable ? 0.46 : 0.32}
          color={usable ? '#eaf6ff' : '#5e6f88'}
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.01}
          outlineColor="#03060f"
        >
          {d.name}
        </Text>
        <Text
          position={[0, yNode - R - 0.55, 0]}
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
