'use client';

import { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { AdaptiveDpr, Text } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import { DYNASTIES, DYNASTIES_WITH_DATA } from '@/content/dynasties';
import type { SelectHandler } from './types';
import { useThemeColor } from '@/lib/use-theme-color';

/**
 * E · 光河（Luminous River）
 * 不摆几何体 —— 依靠粒子流 + 辉光(bloom) + 加色混合 构建"一条发光的河"。
 * 每个朝代 = 河中一团光涡（粒子聚集），而非方块。
 */
const N = DYNASTIES.length;
const GAP = 6; // 沿 Z 纵深间距
const hasData = (id: string) => DYNASTIES_WITH_DATA.has(id);

/** 一团发光粒子：代表一个朝代 */
function Vortex({
  index,
  accent,
  onHover,
  onPick,
  hovered,
}: {
  index: number;
  accent: [number, number, number];
  onHover: (i: number) => void;
  onPick: SelectHandler;
  hovered: number;
}) {
  const group = useRef<THREE.Group>(null);
  const pts = useRef<THREE.Points>(null);
  const usable = hasData(DYNASTIES[index].id);
  const count = usable ? 900 : 260;

  const geom = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const base = new THREE.Color(...accent);
    for (let i = 0; i < count; i++) {
      // 螺旋盘状分布（银盘/星云感）
      const r = Math.pow(Math.random(), 0.6) * 1.6;
      const a = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 0.5 * (1 - r / 2);
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = Math.sin(a) * r;
      const c = base
        .clone()
        .offsetHSL((Math.random() - 0.5) * 0.08, 0, (Math.random() - 0.5) * 0.35);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }, [count, accent]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (pts.current) pts.current.rotation.y = t * (usable ? 0.35 : 0.12) + index;
    if (group.current) {
      const s = hovered === index ? 1.5 : 1;
      group.current.scale.x += (s - group.current.scale.x) * 0.1;
      group.current.scale.y += (s - group.current.scale.y) * 0.1;
      group.current.scale.z += (s - group.current.scale.z) * 0.1;
      group.current.position.y = Math.sin(t * 1.3 + index) * 0.12;
    }
  });

  const z = -((N - 1) * GAP) / 2 + index * GAP;

  return (
    <group ref={group} position={[0, 0, z]}>
      <points
        ref={pts}
        geometry={geom}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(index);
          document.body.style.cursor = usable ? 'pointer' : 'default';
        }}
        onPointerOut={() => {
          onHover(-1);
          document.body.style.cursor = 'default';
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (usable) onPick(DYNASTIES[index]);
        }}
      >
        <pointsMaterial
          size={0.06}
          vertexColors
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation
          toneMapped={false}
        />
      </points>
      {/* 核心光球（提供 bloom 源） */}
      <mesh>
        <sphereGeometry args={[usable ? 0.28 : 0.14, 16, 16]} />
        <meshBasicMaterial
          color={new THREE.Color(accent[0], accent[1], accent[2])}
          toneMapped={false}
        />
      </mesh>
      <Text
        position={[0, 1.9, 0]}
        fontSize={0.62}
        color="#eaf6ff"
        anchorX="center"
        outlineWidth={0.006}
        outlineColor="#03121f"
      >
        {DYNASTIES[index].name}
      </Text>
      <Text position={[0, -1.5, 0]} fontSize={0.26} color="#6b8fbf" anchorX="center">
        {`${DYNASTIES[index].start < 0 ? '前' + -DYNASTIES[index].start : DYNASTIES[index].start}`}
      </Text>
    </group>
  );
}

function RiverBed({ accent }: { accent: [number, number, number] }) {
  const geom = useMemo(() => {
    const n = 2600;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      pos[i * 3] = Math.sin(t * Math.PI * 6) * 0.5 + (Math.random() - 0.5) * 0.4;
      pos[i * 3 + 1] = -1.4 - Math.random() * 0.5;
      pos[i * 3 + 2] = (t - 0.5) * (N * GAP + 8);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  const ref = useRef<THREE.Points>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = Math.sin(clock.elapsedTime * 0.5) * 0.05;
  });
  return (
    <points ref={ref} geometry={geom}>
      <pointsMaterial
        size={0.04}
        color={new THREE.Color(accent[0], accent[1], accent[2])}
        transparent
        opacity={0.5}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
        toneMapped={false}
      />
    </points>
  );
}

function Scene({ onPick }: { onPick: SelectHandler }) {
  const accent = useThemeColor('--lr-accent', [0.3, 0.85, 1]);
  const accent2 = useThemeColor('--lr-accent-2', [0.55, 0.35, 1]);
  const [hovered, setHovered] = useState(-1);

  return (
    <>
      <color attach="background" args={['#03060f']} />
      <fog attach="fog" args={['#03060f', 26, 78]} />
      <ambientLight intensity={0.35} />
      <pointLight
        position={[0, 4, 0]}
        intensity={30}
        color={new THREE.Color(accent[0], accent[1], accent[2])}
      />
      <RiverBed accent={accent2} />
      {DYNASTIES.map((_, i) => (
        <Vortex
          key={i}
          index={i}
          accent={i % 3 === 0 ? accent : accent2}
          hovered={hovered}
          onHover={setHovered}
          onPick={onPick}
        />
      ))}
      <EffectComposer>
        <Bloom
          intensity={1.7}
          luminanceThreshold={0.12}
          luminanceSmoothing={0.35}
          mipmapBlur
          radius={0.8}
        />
        <ChromaticAberration
          blendFunction={BlendFunction.NORMAL}
          offset={[0.0006, 0.0006]}
          radialModulation={false}
          modulationOffset={0}
        />
        <Vignette eskil={false} offset={0.28} darkness={0.85} />
      </EffectComposer>
      <AdaptiveDpr pixelated />
    </>
  );
}

export function Luminous({ onSelect }: { onSelect: SelectHandler }) {
  function Drift() {
    useFrame(({ camera, clock }) => {
      const t = clock.elapsedTime * 0.06;
      camera.position.set(Math.sin(t) * 2.2, 2.6, 20 + Math.sin(t * 1.7) * 1.5);
      camera.lookAt(0, 0, 6 + Math.sin(t * 0.8) * 3);
    });
    return null;
  }
  return (
    <Canvas
      camera={{ position: [0, 2.6, 20], fov: 50 }}
      gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.9 }}
      dpr={[1, 1.75]}
    >
      <Drift />
      <Scene onPick={onSelect} />
    </Canvas>
  );
}
