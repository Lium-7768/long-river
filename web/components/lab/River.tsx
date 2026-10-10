'use client';

import { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Text, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { DYNASTIES, DYNASTIES_WITH_DATA } from '@/content/dynasties';
import type { Dynasty } from './types';
import { useThemeColor } from '@/lib/use-theme-color';

/**
 * A · 时间长河
 * 朝代等距沿纵深(Z)排布成"河中浮岛"，相机 45° 俯瞰，河向远方延伸。
 * 颜色统一冷调，仅悬停/有数据者点亮。
 */

const GAP = 2.2; // 纵深间距（等距，保证每个都看得清）
const hasData = (id: string) => DYNASTIES_WITH_DATA.has(id);

function Island({
  dynasty,
  z,
  color,
  accent,
  onSelect,
}: {
  dynasty: (typeof DYNASTIES)[number];
  z: number;
  color: [number, number, number];
  accent: [number, number, number];
  onSelect: (d: Dynasty) => void;
}) {
  const [hover, setHover] = useState(false);
  const g = useRef<THREE.Group>(null);
  const usable = hasData(dynasty.id);

  useFrame(({ clock }, dt) => {
    if (!g.current) return;
    const t = clock.elapsedTime;
    // 缓慢上下浮动，像浮在水面
    g.current.position.y = Math.sin(t * 1.1 + z) * 0.08;
    const targetScale = hover ? 1.25 : 1;
    g.current.scale.x += (targetScale - g.current.scale.x) * Math.min(dt * 8, 1);
    g.current.scale.z += (targetScale - g.current.scale.z) * Math.min(dt * 8, 1);
  });

  const baseY = usable ? 0.5 : 0.15;
  const c = hover && usable ? accent : color;

  return (
    <group ref={g} position={[0, 0, z]}>
      {/* 浮岛主体：扁立方 + 倒金字塔基座 */}
      <mesh
        position={[0, baseY, 0]}
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
          if (usable) onSelect(dynasty);
        }}
      >
        <boxGeometry args={[2.6, usable ? 0.9 : 0.25, 1.5]} />
        <meshStandardMaterial
          color={c}
          emissive={c}
          emissiveIntensity={usable ? (hover ? 1.1 : 0.45) : 0.08}
          roughness={0.25}
          metalness={0.6}
          toneMapped={false}
        />
      </mesh>
      {/* 底部倒锥，让岛"沉"进河里 */}
      <mesh position={[0, baseY - 0.8, 0]}>
        <coneGeometry args={[1.5, 1.6, 4]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.12}
          roughness={0.5}
          toneMapped={false}
        />
      </mesh>
      {/* 水面光晕 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <ringGeometry args={[1.6, 2.4, 48]} />
        <meshBasicMaterial
          color={c}
          transparent
          opacity={usable ? 0.28 : 0.08}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      {/* 朝代名 */}
      <Text
        position={[0, baseY + 0.9, 0.2]}
        fontSize={0.5}
        color={`rgb(${c.map((v) => Math.round(v * 255)).join(' ')})`}
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.012}
        outlineColor="#000"
        characters="夏商周秦东西汉新三国晋南北朝隋唐五代十国辽北宋西夏金南宋元明清"
      >
        {dynasty.name}
      </Text>
      {/* 年份 */}
      <Text
        position={[0, baseY - 0.55, 0.9]}
        fontSize={0.22}
        color="#7b8aa8"
        anchorX="center"
        anchorY="top"
      >
        {`${dynasty.start < 0 ? '前' + -dynasty.start : dynasty.start}–${dynasty.end < 0 ? '前' + -dynasty.end : dynasty.end}`}
      </Text>
    </group>
  );
}

function Scene({ onSelect }: { onSelect: (d: Dynasty) => void }) {
  const accent = useThemeColor('--lr-accent', [0, 0.9, 1]);
  const riverColor = useThemeColor('--lr-accent-2', [0.48, 0.3, 1]);

  const items = useMemo(
    () => DYNASTIES.map((d, i) => ({ d, z: -((DYNASTIES.length - 1) * GAP) / 2 + i * GAP })),
    [],
  );

  return (
    <>
      <color attach="background" args={['#05070d']} />
      <fog attach="fog" args={['#05070d', 14, 46]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 12, 8]} intensity={1.4} />
      <pointLight position={[0, 6, 6]} intensity={60} color={new THREE.Color(...accent)} />

      {items.map(({ d, z }) => (
        <Island
          key={d.id}
          dynasty={d}
          z={z}
          color={[0.3, 0.42, 0.62]}
          accent={accent}
          onSelect={onSelect}
        />
      ))}

      {/* 河面 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <planeGeometry args={[16, (DYNASTIES.length - 1) * GAP + 10]} />
        <meshStandardMaterial
          color={new THREE.Color(...riverColor)}
          transparent
          opacity={0.06}
          emissive={new THREE.Color(...riverColor)}
          emissiveIntensity={0.06}
          roughness={0.1}
          metalness={0.9}
        />
      </mesh>

      {/* 河岸光带 */}
      {[-7.2, 7.2].map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0, 0]}>
          <planeGeometry args={[0.06, (DYNASTIES.length - 1) * GAP + 10]} />
          <meshBasicMaterial
            color={new THREE.Color(...accent)}
            transparent
            opacity={0.35}
            toneMapped={false}
          />
        </mesh>
      ))}

      <OrbitControls
        enablePan
        enableZoom
        enableRotate={false}
        minDistance={10}
        maxDistance={40}
        minPolarAngle={0.5}
        maxPolarAngle={1.3}
        target={[0, 0, 0]}
      />
    </>
  );
}

export function River({ onSelect }: { onSelect: (d: (typeof DYNASTIES)[number]) => void }) {
  return (
    <Canvas camera={{ position: [7, 9, 14], fov: 42 }} gl={{ antialias: true }} dpr={[1, 2]}>
      <Scene onSelect={onSelect} />
    </Canvas>
  );
}
