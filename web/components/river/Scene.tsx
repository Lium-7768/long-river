'use client';

import { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { riverCurve, pointAt, dynastyT } from './curve';
import { fmtYear } from './year';
import { computeCamera, type CameraMode } from './cameraModes';
import { getStarTexture } from './starTexture';
import { useThemeColor } from '@/lib/use-theme-color';
import type { Dynasty } from '@/lib/dynasty-data';

/**
 * 滚动驱动的时间长河。
 * 相机沿 riverCurve 飞行，progress∈[0,1] 由外部滚动控制（用 ref 传入，避免重渲染）。
 * 朝代轴由 props 传入（来自 /api/dynasties）。
 */

/* ---------- 河道：发光长河 Luxury — 双层光管 + 流动粒子 ---------- */
function RiverRibbon() {
  const accent = useThemeColor('--lr-accent', [0.15, 0.7, 1]);
  // 水墨河：浓墨 + 洒金（原 accent 作冷调点缀）
  const gold = useMemo(() => new THREE.Color(184 / 255, 149 / 255, 90 / 255), []);
  const goldEmissive = useMemo(() => new THREE.Color(0.52, 0.38, 0.16), []);
  const inkColor = useMemo(() => new THREE.Color(0.08, 0.1, 0.14), []);

  // 双层 Tube：外晕(粗、极透) + 内核(细、亮)
  const { tubeOuter, tubeInner } = useMemo(() => {
    return {
      tubeOuter: new THREE.TubeGeometry(riverCurve, 320, 0.34, 14, false),
      tubeInner: new THREE.TubeGeometry(riverCurve, 320, 0.11, 12, false),
    };
  }, []);

  const outerMat = useRef<THREE.MeshStandardMaterial>(null);
  const innerMat = useRef<THREE.ShaderMaterial>(null);

  // 流动粒子：沿河道切线流动
  const particleCount = 520;
  const particleData = useMemo(() => {
    const ts = new Float32Array(particleCount);
    const speeds = new Float32Array(particleCount);
    const sizes = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) {
      ts[i] = Math.random();
      speeds[i] = 0.00055 + Math.random() * 0.0011;
      sizes[i] = 0.18 + Math.random() * 0.22;
    }
    return { ts, speeds, sizes };
  }, []);
  const particleGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(particleCount * 3);
    const col = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const p = riverCurve.getPointAt(particleData.ts[i]);
      pos[i * 3] = p.x + (Math.random() - 0.5) * 0.35;
      pos[i * 3 + 1] = p.y + (Math.random() - 0.5) * 0.18;
      pos[i * 3 + 2] = p.z + (Math.random() - 0.5) * 0.35;
      const c = i % 3 === 0 ? gold : new THREE.Color(accent[0], accent[1], accent[2]);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(particleData.sizes, 1));
    return g;
  }, [accent, gold, particleData.sizes, particleData.ts]);

  const particleRef = useRef<THREE.Points>(null);

  // 流动 shader：水墨脉冲（墨底 + 洒金光）
  const shaderUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uGold: { value: gold.clone() },
      uInk: { value: inkColor.clone() },
      uAccent: { value: new THREE.Color(accent[0], accent[1], accent[2]) },
    }),
    [accent, gold, inkColor],
  );

  useEffect(() => {
    shaderUniforms.uAccent.value.set(accent[0], accent[1], accent[2]);
  }, [accent, shaderUniforms]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // 外晕呼吸
    if (outerMat.current) {
      outerMat.current.emissiveIntensity = 0.55 + Math.sin(t * 0.9) * 0.18;
      outerMat.current.opacity = 0.22 + Math.sin(t * 0.7) * 0.06;
    }
    // 内核流动
    if (innerMat.current) innerMat.current.uniforms.uTime.value = t;

    // 粒子沿河推进
    if (particleRef.current) {
      const pos = particleRef.current.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < particleCount; i++) {
        particleData.ts[i] += particleData.speeds[i];
        if (particleData.ts[i] > 1) particleData.ts[i] -= 1;
        const p = riverCurve.getPointAt(particleData.ts[i]);
        // 轻微横向摆动
        const sway = Math.sin(t * 0.8 + i * 0.37) * 0.12;
        pos.setXYZ(i, p.x + sway, p.y + Math.sin(t * 0.6 + i) * 0.05, p.z + Math.cos(t * 0.5 + i) * 0.08);
      }
      pos.needsUpdate = true;
      const mat = particleRef.current.material as THREE.PointsMaterial;
      mat.opacity = 0.65 + Math.sin(t * 1.1) * 0.12;
    }
  });

  return (
    <group>
      {/* 外晕：大半径、极透、加法混合 */}
      <mesh geometry={tubeOuter}>
        <meshStandardMaterial
          ref={outerMat}
          color={gold}
          emissive={goldEmissive}
          emissiveIntensity={0.55}
          transparent
          opacity={0.22}
          roughness={0.85}
          metalness={0.0}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {/* 内核：流动 shader */}
      <mesh geometry={tubeInner}>
        <shaderMaterial
          ref={innerMat}
          uniforms={shaderUniforms}
          transparent
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          vertexShader={`
            varying vec2 vUv;
            void main(){
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
            }
          `}
          fragmentShader={`
            uniform float uTime;
            uniform vec3 uGold;
            uniform vec3 uInk;
            uniform vec3 uAccent;
            varying vec2 vUv;
            void main(){
              float flow = sin(vUv.x * 28.0 - uTime * 1.9) * 0.5 + 0.5;
              float flow2 = sin(vUv.x * 52.0 - uTime * 2.7) * 0.5 + 0.5;
              float pulse = pow(flow, 3.0) * 0.42 + pow(flow2, 6.0) * 0.28;
              // 水墨基调：墨底 + 洒金光，accent 仅作冷调点缀
              vec3 base = mix(uInk * 1.35, uGold * 0.9, 0.42);
              base = mix(base, uAccent * 0.35, 0.12);
              vec3 col = base + pulse * vec3(0.42,0.36,0.22);
              float alpha = 0.32 + pulse * 0.44;
              float edge = smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.82, vUv.y);
              alpha *= edge;
              gl_FragColor = vec4(col, alpha);
            }
          `}
        />
      </mesh>
      {/* 流动金粉 */}
      <points ref={particleRef} geometry={particleGeom}>
        <pointsMaterial
          size={0.22}
          map={getStarTexture()}
          vertexColors
          transparent
          opacity={0.72}
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

/* ---------- 单个朝代节点：能量晶体（fa269f5 经典版，适配当前 props） ---------- */
function DynastyNode({
  d,
  t,
  usable,
  onPick,
  index,
}: {
  d: Dynasty;
  t: number;
  usable: boolean;
  onPick: (i: number) => void;
  index: number;
}) {
  const [hover, setHover] = useState(false);

  const coreRef = useRef<THREE.Mesh>(null);
  const shellRef = useRef<THREE.Mesh>(null);
  const ringARef = useRef<THREE.Mesh>(null);
  const ringBRef = useRef<THREE.Mesh>(null);
  const beamRef = useRef<THREE.Mesh>(null);
  const textRef = useRef<THREE.Group>(null);
  const sparkRef = useRef<THREE.Points>(null);

  const base = useMemo(() => pointAt(t), [t]);
  // 水墨晶体：朱砂印章 + 洒金，弱化冷青
  const cinnabar: [number, number, number] = [178 / 255, 36 / 255, 30 / 255];
  const gold: [number, number, number] = [184 / 255, 149 / 255, 90 / 255];
  const col: [number, number, number] = usable ? cinnabar : [0.35, 0.42, 0.55];
  const col2: [number, number, number] = usable ? gold : [0.42, 0.38, 0.32];
  const color = new THREE.Color(col[0], col[1], col[2]);
  const color2 = new THREE.Color(col2[0], col2[1], col2[2]);
  const yNode = usable ? 1.0 : 0.5;
  const R = usable ? 0.52 : 0.28;

  const sparkGeom = useMemo(() => {
    const count = usable ? 90 : 20;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const b = Math.acos(Math.random() * 2 - 1);
      const r = R * (1.6 + Math.random() * 1.8);
      pos[i * 3] = Math.sin(b) * Math.cos(a) * r;
      pos[i * 3 + 1] = Math.cos(b) * r;
      pos[i * 3 + 2] = Math.sin(b) * Math.sin(a) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, [R, usable]);

  useFrame(({ clock, camera }) => {
    const t0 = clock.elapsedTime;
    const pulse = usable ? 1 + Math.sin(t0 * 2 + index) * 0.12 : 1;
    if (coreRef.current) {
      coreRef.current.rotation.y = t0 * (usable ? 0.5 : 0.1) + index;
      coreRef.current.rotation.x = Math.sin(t0 * 0.4 + index) * 0.3;
      coreRef.current.scale.setScalar(pulse);
    }
    if (shellRef.current) {
      shellRef.current.rotation.y = -t0 * (usable ? 0.3 : 0.08) - index;
      shellRef.current.rotation.z = t0 * 0.2;
    }
    if (ringARef.current) {
      ringARef.current.rotation.z = t0 * (usable ? 0.7 : 0.15);
      ringARef.current.rotation.x = Math.PI / 2.4;
    }
    if (ringBRef.current) {
      ringBRef.current.rotation.z = -t0 * (usable ? 0.5 : 0.1);
      ringBRef.current.rotation.x = Math.PI / 1.6;
      ringBRef.current.rotation.y = t0 * 0.3;
    }
    if (beamRef.current) {
      const m = beamRef.current.material as THREE.MeshBasicMaterial;
      m.opacity = (usable ? 0.28 : 0.08) * (0.7 + Math.sin(t0 * 2.2 + index) * 0.3);
    }
    if (sparkRef.current) sparkRef.current.rotation.y = t0 * 0.25 + index;
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
        {/* 内发光核心：八面体 */}
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
        {/* 外层线框壳：反向自转 */}
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
        {/* 双能量环 */}
        <mesh ref={ringARef}>
          <torusGeometry args={[R * 1.9, 0.018, 8, 64]} />
          <meshBasicMaterial color={color} transparent opacity={usable ? 0.85 : 0.2} toneMapped={false} />
        </mesh>
        <mesh ref={ringBRef}>
          <torusGeometry args={[R * 2.35, 0.012, 8, 64]} />
          <meshBasicMaterial color={color2} transparent opacity={usable ? 0.6 : 0.15} toneMapped={false} />
        </mesh>
        {/* 环绕微粒 90 点 */}
        <points ref={sparkRef} geometry={sparkGeom}>
          <pointsMaterial
            size={0.05}
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

      {/* 名字（billboard） */}
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
  dynasties,
  progress,
  mode,
  onPick,
}: {
  dynasties: Dynasty[];
  progress: React.MutableRefObject<number>;
  mode: CameraMode;
  onPick: (i: number) => void;
}) {
  const ts = useMemo(() => dynastyT(dynasties.length), [dynasties.length]);
  const usableIds = useMemo(() => dynasties.map((d) => d.id), [dynasties]);
  return (
    <>
      <color attach="background" args={['#03060f']} />
      <fog attach="fog" args={['#03060f', 30, 95]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[5, 10, 5]} intensity={0.7} />
      <Starfield />
      <RiverRibbon />
      {dynasties.map((d, i) => (
        <DynastyNode
          key={d.id}
          index={i}
          d={d}
          t={ts[i]}
          usable={usableIds.includes(d.id)}
          onPick={onPick}
        />
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
