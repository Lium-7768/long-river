'use client';

import { Canvas } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { DYNASTIES, DYNASTIES_WITH_DATA } from '@/content/dynasties';
import type { Dynasty } from './types';
import { useThemeColor } from '@/lib/use-theme-color';

/**
 * D · 卷轴：横向平铺长卷，博物馆展签式，横向滚动。
 * 用正交相机，完全没有透视——像文献长卷。
 */
const W = 1.9; // 每格宽
const hasData = (id: string) => DYNASTIES_WITH_DATA.has(id);

function Panel({ d, x, accent }: { d: Dynasty; x: number; accent: [number, number, number] }) {
  const usable = hasData(d.id);
  return (
    <group position={[x, 0, 0]}>
      {/* 竖长条碑 */}
      <mesh>
        <boxGeometry args={[W * 0.7, 5, 0.2]} />
        <meshStandardMaterial
          color={usable ? new THREE.Color(0.1, 0.16, 0.26) : new THREE.Color(0.06, 0.07, 0.1)}
          emissive={usable ? new THREE.Color(...accent) : new THREE.Color(0)}
          emissiveIntensity={0.12}
          roughness={0.6}
          metalness={0.3}
          toneMapped={false}
        />
      </mesh>
      <Text
        position={[0, 1.6, 0.15]}
        fontSize={0.5}
        color={usable ? '#dbeafe' : '#556'}
        anchorX="center"
      >
        {d.name}
      </Text>
      <Text
        position={[0, -1.4, 0.15]}
        fontSize={0.22}
        color="#66788f"
        anchorX="center"
        maxWidth={W * 0.62}
      >
        {`${d.start < 0 ? '前' + -d.start : d.start}–${d.end < 0 ? '前' + -d.end : d.end}`}
      </Text>
      <Text
        position={[0, -2.2, 0.15]}
        fontSize={0.18}
        color={usable ? '#8fb4e0' : '#445'}
        anchorX="center"
        maxWidth={W * 0.62}
      >
        {d.note}
      </Text>
      {usable && (
        <mesh position={[0, -2.9, 0.15]}>
          <planeGeometry args={[W * 0.5, 0.04]} />
          <meshBasicMaterial color={new THREE.Color(...accent)} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

export function Scroll() {
  const accent = useThemeColor('--lr-accent', [0, 0.9, 1]);
  const span = DYNASTIES.length * W;
  return (
    <Canvas
      orthographic
      camera={{ position: [0, 0, 12], zoom: 90, near: 0.1, far: 100 }}
      gl={{ antialias: true }}
      dpr={[1, 2]}
    >
      <color attach="background" args={['#08090f']} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 6, 8]} intensity={0.8} />
      {DYNASTIES.map((d, i) => (
        <Panel key={d.id} d={d} x={-span / 2 + i * W + W / 2} accent={accent} />
      ))}
    </Canvas>
  );
}
