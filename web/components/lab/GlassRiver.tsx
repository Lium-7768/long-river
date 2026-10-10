'use client';

import { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Text, MeshReflectorMaterial, Environment, Lightformer } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, DepthOfField } from '@react-three/postprocessing';
import * as THREE from 'three';
import { DYNASTIES, DYNASTIES_WITH_DATA } from '@/content/dynasties';
import type { SelectHandler } from './types';
import { useThemeColor } from '@/lib/use-theme-color';

/**
 * F · 深空玻璃长卷（按研究报告重建）
 * 朝代 = 高细比半透明玻璃碑，内嵌发光丝；悬浮于镜面反射的深空之河上。
 * 关键：MeshPhysicalMaterial(transmission/iridescence) + ACESFilmic + emissive-only bloom。
 */
const N = DYNASTIES.length;
const GAP = 4.2;
const hasData = (id: string) => DYNASTIES_WITH_DATA.has(id);

function Stele({
  index,
  accent,
  onPick,
}: {
  index: number;
  accent: [number, number, number];
  onPick: SelectHandler;
}) {
  const d = DYNASTIES[index];
  const usable = hasData(d.id);
  const [hover, setHover] = useState(false);
  const g = useRef<THREE.Group>(null);
  const z = -((N - 1) * GAP) / 2 + index * GAP;

  useFrame(({ clock }) => {
    if (g.current) {
      g.current.position.y = 1.6 + Math.sin(clock.elapsedTime * 1.1 + index) * 0.08;
      const s = hover ? 1.12 : 1;
      g.current.scale.y += (s - g.current.scale.y) * 0.1;
    }
  });

  const H = usable ? 3.2 : 1.5;

  return (
    <group ref={g} position={[0, 1.6, z]}>
      {/* 玻璃碑主体 */}
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = usable ? 'pointer' : 'default';
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = 'default';
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (usable) onPick(d);
        }}
      >
        <boxGeometry args={[1.5, H, 0.32]} />
        <meshPhysicalMaterial
          color={usable ? 0x141c2e : 0x0b1018}
          metalness={0}
          roughness={0.15}
          transmission={usable ? 0.85 : 0.4}
          thickness={1.5}
          ior={1.45}
          clearcoat={1}
          clearcoatRoughness={0.1}
          iridescence={usable ? 0.6 : 0.1}
          iridescenceIOR={1.3}
          emissive={new THREE.Color(...accent)}
          emissiveIntensity={usable ? (hover ? 0.5 : 0.15) : 0.02}
          envMapIntensity={1.2}
          transparent
          toneMapped={false}
        />
      </mesh>
      {/* 内嵌发光丝：亮度∝可用（近似 prominence） */}
      {usable &&
        Array.from({ length: 7 }).map((_, i) => (
          <mesh key={i} position={[(i - 3) * 0.17, 0, 0]}>
            <boxGeometry args={[0.02, H * 0.8, 0.02]} />
            <meshBasicMaterial
              color={new THREE.Color(accent[0], accent[1], accent[2])}
              transparent
              opacity={0.85}
              toneMapped={false}
            />
          </mesh>
        ))}
      {/* 碑名 */}
      <Text
        position={[0, H / 2 + 0.45, 0.2]}
        fontSize={0.52}
        color="#dbeafe"
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.006}
        outlineColor="#03060f"
      >
        {d.name}
      </Text>
      <Text
        position={[0, -H / 2 - 0.35, 0.2]}
        fontSize={0.22}
        color="#7b8aa8"
        anchorX="center"
        anchorY="top"
      >
        {`${d.start < 0 ? '前' + -d.start : d.start}–${d.end < 0 ? '前' + -d.end : d.end}`}
      </Text>
      {/* 河面涟漪光晕 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.55, 0]}>
        <ringGeometry args={[0.9, 1.5, 40]} />
        <meshBasicMaterial
          color={new THREE.Color(accent[0], accent[1], accent[2])}
          transparent
          opacity={usable ? 0.22 : 0.05}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function Scene({ onPick }: { onPick: SelectHandler }) {
  const accent = useThemeColor('--lr-accent', [0, 0.9, 1]);
  const riverLen = N * GAP + 14;

  return (
    <>
      <color attach="background" args={['#05070d']} />
      <fog attach="fog" args={['#05070d', 22, 62]} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[4, 10, 6]} intensity={0.8} />
      <pointLight
        position={[0, 4, 4]}
        intensity={40}
        color={new THREE.Color(accent[0], accent[1], accent[2])}
      />

      {/* 环境光（玻璃反射的来源） */}
      <Environment resolution={128}>
        <Lightformer
          intensity={2}
          position={[0, 5, 0]}
          scale={[10, 1, 1]}
          color={new THREE.Color(accent[0], accent[1], accent[2])}
        />
        <Lightformer intensity={1} position={[-5, 2, 5]} scale={[5, 5, 1]} color="#4a6a9a" />
        <Lightformer
          intensity={1}
          position={[6, 3, -5]}
          scale={[5, 5, 1]}
          color={new THREE.Color(0.5, 0.35, 1)}
        />
      </Environment>

      {/* 镜面河面 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.6, 0]}>
        <planeGeometry args={[24, riverLen]} />
        <MeshReflectorMaterial
          resolution={512}
          blur={[300, 60]}
          mixBlur={0.9}
          mixStrength={18}
          roughness={0.9}
          depthScale={1.1}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.2}
          color="#060a12"
          metalness={0.6}
          mirror={0.4}
        />
      </mesh>

      {DYNASTIES.map((_, i) => (
        <Stele key={i} index={i} accent={accent} onPick={onPick} />
      ))}

      <EffectComposer multisampling={4}>
        <DepthOfField focusDistance={0.012} focalLength={0.05} bokehScale={3} height={480} />
        <Bloom luminanceThreshold={0.9} intensity={0.8} mipmapBlur radius={0.7} />
        <Vignette eskil={false} offset={0.3} darkness={0.9} />
      </EffectComposer>
    </>
  );
}

export function GlassRiver({ onSelect }: { onSelect: SelectHandler }) {
  function Drift() {
    useFrame(({ camera, clock }) => {
      const t = clock.elapsedTime * 0.05;
      camera.position.set(Math.sin(t) * 3.5 + 2, 3.2 + Math.sin(t * 1.3) * 0.4, 16);
      camera.lookAt(0, 1.6, 2 + Math.sin(t * 0.7) * 4);
    });
    return null;
  }
  return (
    <Canvas
      camera={{ position: [2, 3.2, 16], fov: 45 }}
      gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.9 }}
      dpr={[1, 1.75]}
    >
      <Drift />
      <Scene onPick={onSelect} />
    </Canvas>
  );
}
