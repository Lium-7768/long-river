'use client';

import { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { DYNASTIES, DYNASTIES_WITH_DATA } from '@/content/dynasties';
import type { Dynasty, SelectHandler } from './types';
import { useThemeColor } from '@/lib/use-theme-color';

/**
 * B · 时间转轮
 * 朝代沿一个水平大圆环排布，像仪表盘/唱片；相机在环外低角度，可旋转环。
 */
const R = 9;
const hasData = (id: string) => DYNASTIES_WITH_DATA.has(id);

function Node({
  d,
  angle,
  color,
  accent,
  onSelect,
}: {
  d: Dynasty;
  angle: number;
  color: [number, number, number];
  accent: [number, number, number];
  onSelect: SelectHandler;
}) {
  const [hover, setHover] = useState(false);
  const usable = hasData(d.id);
  const c = hover && usable ? accent : color;
  const x = Math.sin(angle) * R;
  const z = Math.cos(angle) * R;
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (g.current)
      g.current.position.y = Math.sin(clock.elapsedTime * 1.2 + angle * 3) * 0.12 + 0.5;
  });
  return (
    <group ref={g} position={[x, 0, z]} rotation={[0, angle, 0]}>
      <mesh
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = usable ? 'pointer' : 'default';
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = 'default';
        }}
        onClick={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          if (usable) onSelect(d);
        }}
      >
        <cylinderGeometry args={[0.75, 0.75, usable ? 1.6 : 0.5, 6]} />
        <meshStandardMaterial
          color={c}
          emissive={c}
          emissiveIntensity={usable ? (hover ? 1.2 : 0.5) : 0.1}
          metalness={0.7}
          roughness={0.25}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, -1.1, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 1.4, 8]} />
        <meshBasicMaterial color={accent} transparent opacity={0.3} toneMapped={false} />
      </mesh>
      <Text
        position={[0, usable ? 1.4 : 0.9, 0]}
        fontSize={0.55}
        color={`rgb(${c.map((v: number) => Math.round(v * 255)).join(' ')})`}
        anchorX="center"
        outlineWidth={0.012}
        outlineColor="#000"
      >
        {d.name}
      </Text>
      <Text position={[0, -1.9, 0]} fontSize={0.24} color="#7b8aa8" anchorX="center">
        {`${d.start < 0 ? '前' + -d.start : d.start}`}
      </Text>
    </group>
  );
}

function Scene({ onSelect }: { onSelect: SelectHandler }) {
  const accent = useThemeColor('--lr-accent', [0, 0.9, 1]);
  const ring = useMemo(
    () => DYNASTIES.map((d, i) => ({ d, a: (i / DYNASTIES.length) * Math.PI * 2 })),
    [],
  );
  return (
    <>
      <color attach="background" args={['#05070d']} />
      <fog attach="fog" args={['#05070d', 16, 40]} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[6, 12, 6]} intensity={1.3} />
      <pointLight position={[0, 8, 0]} intensity={80} color={new THREE.Color(...accent)} />
      {/* 环形轨道 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, 0]}>
        <torusGeometry args={[R, 0.04, 8, 96]} />
        <meshBasicMaterial
          color={new THREE.Color(...accent)}
          transparent
          opacity={0.35}
          toneMapped={false}
        />
      </mesh>
      {ring.map(({ d, a }) => (
        <Node
          key={d.id}
          d={d}
          angle={a}
          color={[0.32, 0.44, 0.64]}
          accent={accent}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

export function Carousel({ onSelect }: { onSelect: SelectHandler }) {
  // 相机缓慢绕环旋转 → 仪表盘感
  function Rig() {
    useFrame(({ camera, clock }) => {
      const t = clock.elapsedTime * 0.08;
      camera.position.x = Math.sin(t) * (R + 7);
      camera.position.z = Math.cos(t) * (R + 7);
      camera.position.y = 5;
      camera.lookAt(0, 0.5, 0);
    });
    return null;
  }
  return (
    <Canvas camera={{ position: [R + 7, 5, 0], fov: 40 }} gl={{ antialias: true }} dpr={[1, 2]}>
      <Rig />
      <Scene onSelect={onSelect} />
    </Canvas>
  );
}
