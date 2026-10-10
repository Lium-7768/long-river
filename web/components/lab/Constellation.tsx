'use client';

import { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { DYNASTIES, DYNASTIES_WITH_DATA } from '@/content/dynasties';
import type { Dynasty, SelectHandler } from './types';
import { useThemeColor } from '@/lib/use-theme-color';

/**
 * C · 星汉
 * 朝代 = 星辰，按时间沿一条缓弧排布于深空，连成"星河"。
 * 星点有大小差异（大一统朝=亮星），背景漂浮粒子。
 */
const hasData = (id: string) => DYNASTIES_WITH_DATA.has(id);

function Star({
  d,
  t,
  accent,
  onSelect,
}: {
  d: Dynasty;
  t: number;
  accent: [number, number, number];
  onSelect: SelectHandler;
}) {
  const [hover, setHover] = useState(false);
  const usable = hasData(d.id);
  const ref = useRef<THREE.Mesh>(null);
  // 沿弧线排布
  const x = (t - 0.5) * 26;
  const y = Math.sin(t * Math.PI * 1.4) * 3 - 1;
  const z = Math.cos(t * Math.PI * 1.1) * 2;
  const size = usable ? 0.42 : 0.2;

  useFrame(({ clock }) => {
    if (ref.current) {
      const s = (hover ? 1.6 : 1) * (1 + Math.sin(clock.elapsedTime * 2 + t * 10) * 0.08);
      ref.current.scale.setScalar(s);
    }
  });

  return (
    <group position={[x, y, z]}>
      {/* 星核 */}
      <mesh
        ref={ref}
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
          if (usable) onSelect(d);
        }}
      >
        <sphereGeometry args={[size, 20, 20]} />
        <meshBasicMaterial
          color={usable ? new THREE.Color(...accent) : new THREE.Color(0.35, 0.45, 0.6)}
          toneMapped={false}
        />
      </mesh>
      {/* 光晕 */}
      <sprite scale={[size * 6, size * 6, 1]}>
        <spriteMaterial
          color={usable ? new THREE.Color(...accent) : new THREE.Color(0.3, 0.4, 0.6)}
          transparent
          opacity={hover ? 0.5 : 0.22}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>
      <Text
        position={[0, size + 0.45, 0]}
        fontSize={0.42}
        color={usable ? '#cfe9ff' : '#5f7290'}
        anchorX="center"
      >
        {d.name}
      </Text>
      <Text position={[0, -size - 0.5, 0]} fontSize={0.2} color="#5f7290" anchorX="center">
        {`${d.start < 0 ? '前' + -d.start : d.start}`}
      </Text>
    </group>
  );
}

function Dust() {
  const ref = useRef<THREE.Points>(null);
  const geom = useMemo(() => {
    const n = 800;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 60;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 30;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 40 - 10;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.01;
  });
  return (
    <points ref={ref} geometry={geom}>
      <pointsMaterial
        size={0.06}
        color="#4a6a9a"
        transparent
        opacity={0.5}
        sizeAttenuation
        toneMapped={false}
      />
    </points>
  );
}

export function Constellation({ onSelect }: { onSelect: SelectHandler }) {
  const accent = useThemeColor('--lr-accent', [0, 0.9, 1]);
  const stars = useMemo(
    () =>
      DYNASTIES.map((d, i) => ({ d, t: DYNASTIES.length > 1 ? i / (DYNASTIES.length - 1) : 0 })),
    [],
  );
  // 星河连线
  const lineGeom = useMemo(() => {
    const pts = stars.map(
      ({ t }) =>
        new THREE.Vector3(
          (t - 0.5) * 26,
          Math.sin(t * Math.PI * 1.4) * 3 - 1,
          Math.cos(t * Math.PI * 1.1) * 2,
        ),
    );
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [stars]);

  return (
    <Canvas camera={{ position: [0, 2, 22], fov: 45 }} gl={{ antialias: true }} dpr={[1, 2]}>
      <color attach="background" args={['#03040a']} />
      <ambientLight intensity={0.3} />
      <Dust />
      <line>
        <primitive object={lineGeom} attach="geometry" />
        <lineBasicMaterial
          color={new THREE.Color(...accent)}
          transparent
          opacity={0.18}
          toneMapped={false}
        />
      </line>
      {stars.map(({ d, t }) => (
        <Star key={d.id} d={d} t={t} accent={accent} onSelect={onSelect} />
      ))}
    </Canvas>
  );
}
