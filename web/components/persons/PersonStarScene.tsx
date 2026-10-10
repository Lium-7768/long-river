'use client';

import { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { PersonBrief } from '@/lib/api';
import { getStarTexture } from '@/components/river/starTexture';
import { useThemeColor } from '@/lib/use-theme-color';

/**
 * 第二层：人物星群。
 * 每人一颗星 —— fame_score 决定大小/亮度；位置由生卒年 + 哈希散布。
 * 点星 → 进第三层。
 */

const GOLDEN = Math.PI * (3 - Math.sqrt(5)); // 黄金角，做均匀球面分布

function PersonStar({
  person,
  index,
  total,
  maxFame,
  color,
  color2,
  onPick,
}: {
  person: PersonBrief;
  index: number;
  total: number;
  maxFame: number;
  color: THREE.Color;
  color2: THREE.Color;
  onPick: (p: PersonBrief) => void;
}) {
  const [hover, setHover] = useState(false);
  const g = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);

  // 星的大小 ∝ fame（对数压缩，避免极端）
  const fame = person.fame_score ?? 0;
  const norm = maxFame > 0 ? Math.log(1 + fame) / Math.log(1 + maxFame) : 0;
  const R = 0.05 + norm * 0.22;

  // 球面均匀分布（Fibonacci sphere）+ 按生卒年微调
  const pos = useMemo<[number, number, number]>(() => {
    const i = index;
    const y = 1 - (i / Math.max(total - 1, 1)) * 2; // -1..1
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = GOLDEN * i;
    const scale = 9;
    return [Math.cos(theta) * radius * scale, y * scale * 0.6, Math.sin(theta) * radius * scale];
  }, [index, total]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (core.current) {
      const pulse = 1 + Math.sin(t * 2 + index * 0.7) * 0.12;
      core.current.scale.setScalar(pulse * (hover ? 1.8 : 1));
    }
    if (g.current) {
      // 极缓慢自转
      g.current.rotation.y = t * 0.03;
    }
  });

  const c = norm > 0.55 ? color : color2;

  return (
    <group position={pos}>
      <group ref={g}>
        {/* 核心光球 */}
        <mesh
          ref={core}
          onPointerOver={(e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation();
            setHover(true);
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            setHover(false);
            document.body.style.cursor = 'default';
          }}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            onPick(person);
          }}
        >
          <sphereGeometry args={[R, 12, 12]} />
          <meshBasicMaterial color={c} toneMapped={false} />
        </mesh>
        {/* 柔光 */}
        <sprite scale={[R * 4.5, R * 4.5, 1]}>
          <spriteMaterial
            map={getStarTexture()}
            color={c}
            transparent
            opacity={norm > 0.4 ? 0.4 : 0.18}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>
      </group>
      {/* 仅名人显示名字 */}
      {norm > 0.62 && (
        <Text
          position={[0, -R - 0.5, 0]}
          fontSize={0.28}
          color="#dce8f8"
          anchorX="center"
          anchorY="top"
          outlineWidth={0.008}
          outlineColor="#03060f"
        >
          {person.name}
        </Text>
      )}
    </group>
  );
}

function Cluster({
  persons,
  onPick,
}: {
  persons: PersonBrief[];
  onPick: (p: PersonBrief) => void;
}) {
  const color = useThemeColor('--lr-accent', [0.15, 0.7, 1]);
  const color2 = useThemeColor('--lr-accent-2', [0.5, 0.35, 1]);
  const c1 = useMemo(() => new THREE.Color(color[0], color[1], color[2]), [color]);
  const c2 = useMemo(() => new THREE.Color(color2[0], color2[1], color2[2]), [color2]);
  const maxFame = useMemo(() => Math.max(1, ...persons.map((p) => p.fame_score ?? 0)), [persons]);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, dt) => {
    if (groupRef.current) groupRef.current.rotation.y += dt * 0.02;
  });

  return (
    <group ref={groupRef}>
      {persons.map((p, i) => (
        <PersonStar
          key={p.id}
          person={p}
          index={i}
          total={persons.length}
          maxFame={maxFame}
          color={c1}
          color2={c2}
          onPick={onPick}
        />
      ))}
    </group>
  );
}

function Rig() {
  useFrame(({ camera, clock }) => {
    const t = clock.elapsedTime * 0.05;
    camera.position.set(Math.sin(t) * 4, 2 + Math.sin(t * 1.3) * 1, 20);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

export function PersonStarScene({
  persons,
  onPick,
}: {
  persons: PersonBrief[];
  onPick: (p: PersonBrief) => void;
}) {
  return (
    <Canvas
      camera={{ position: [0, 2, 20], fov: 50 }}
      gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
      dpr={[1, 1.75]}
    >
      <color attach="background" args={['#03060f']} />
      <ambientLight intensity={0.4} />
      <Cluster persons={persons} onPick={onPick} />
      <Rig />
      <EffectComposer multisampling={0}>
        <Bloom
          intensity={0.7}
          luminanceThreshold={0.5}
          luminanceSmoothing={0.5}
          mipmapBlur
          radius={0.6}
        />
        <Vignette eskil={false} offset={0.3} darkness={0.8} />
      </EffectComposer>
    </Canvas>
  );
}
