'use client';

import { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Text, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { DYNASTIES, DYNASTIES_WITH_DATA, type Dynasty } from '@/content/dynasties';
import { useThemeColors } from '@/lib/use-theme-color';
import { cssRgb } from '@/lib/theme';

const H = 1.15; // 块高
const D = 1.15; // 块深

/** 全局时间跨度 → 归一化到屏幕宽度 */
function useLayout() {
  return useMemo(() => {
    const min = Math.min(...DYNASTIES.map((d) => d.start));
    const span = Math.max(...DYNASTIES.map((d) => d.end)) - min;
    const totalW = 22; // 固定视觉宽度
    const scale = (y: number) => ((y - min) / span) * totalW - totalW / 2;
    let cursor = -999;
    const blocks = DYNASTIES.map((d) => {
      const x0 = scale(d.start);
      const x1 = scale(d.end);
      // 避免极短朝代块重叠：最小宽度
      const w = Math.max(x1 - x0, 0.22);
      const x = x0 + w / 2;
      cursor = Math.max(cursor, x1);
      return { d, x, w };
    });
    return { blocks, totalW };
  }, []);
}

function Block({
  dynasty,
  x,
  w,
  color,
  onSelect,
}: {
  dynasty: Dynasty;
  x: number;
  w: number;
  color: string;
  onSelect: (d: Dynasty) => void;
}) {
  const [hover, setHover] = useState(false);
  const mesh = useRef<THREE.Mesh>(null);
  const hasData = DYNASTIES_WITH_DATA.has(dynasty.id);

  useFrame((_, dt) => {
    if (mesh.current) {
      const target = hover ? H * 1.5 : H;
      mesh.current.scale.y += (target - mesh.current.scale.y) * Math.min(dt * 10, 1);
    }
  });

  return (
    <group position={[x, 0, 0]}>
      <mesh
        ref={mesh}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = hasData ? 'pointer' : 'default';
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = 'default';
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (hasData) onSelect(dynasty);
        }}
      >
        <boxGeometry args={[w, H, D]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hover ? 0.9 : 0.35}
          roughness={0.35}
          metalness={0.4}
          toneMapped={false}
        />
      </mesh>
      <Text
        position={[0, H * 0.95, D / 2 + 0.01]}
        fontSize={0.24}
        color={color}
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.008}
        outlineColor="#000"
      >
        {dynasty.name}
      </Text>
      <Text
        position={[0, -H * 0.75, D / 2 + 0.01]}
        fontSize={0.12}
        color="#94a3b8"
        anchorX="center"
        anchorY="top"
      >
        {`${dynasty.start < 0 ? '前' + -dynasty.start : dynasty.start}`}
      </Text>
    </group>
  );
}

function Scene({ onSelect }: { onSelect: (d: Dynasty) => void }) {
  const { blocks } = useLayout();
  // 每个朝代的颜色都从 CSS 变量读（主题切换自动变）
  const vars = useMemo(() => blocks.map((b) => b.d.colorVar), [blocks]);
  const colors = useThemeColors(vars);
  const groundRef = useRef<THREE.GridHelper>(null);

  useFrame(({ clock }) => {
    if (groundRef.current) {
      // 缓慢流动的网格，增强科技感
      groundRef.current.position.z = ((clock.elapsedTime * 0.3) % 2) - 1;
    }
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[6, 8, 6]} intensity={1.2} />
      <pointLight
        position={[-6, 3, 4]}
        intensity={40}
        color={cssRgb('--lr-accent') as unknown as THREE.ColorRepresentation}
      />

      {blocks.map((b, i) => (
        <Block
          key={b.d.id}
          dynasty={b.d}
          x={b.x}
          w={b.w}
          color={`rgb(${colors[i].map((v) => Math.round(v * 255)).join(' ')})`}
          onSelect={onSelect}
        />
      ))}

      <gridHelper
        ref={groundRef}
        args={[
          40,
          40,
          new THREE.Color(...cssRgb('--lr-line')),
          new THREE.Color(...cssRgb('--lr-line')),
        ]}
        position={[0, -H * 0.9, 0]}
      />
      <OrbitControls
        enablePan
        enableZoom
        enableRotate={false}
        minDistance={8}
        maxDistance={26}
        target={[0, 0, 0]}
      />
    </>
  );
}

export function Timeline({ onSelect }: { onSelect: (d: Dynasty) => void }) {
  return (
    <Canvas
      camera={{ position: [0, 3.2, 13], fov: 45 }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 2]}
    >
      <Scene onSelect={onSelect} />
    </Canvas>
  );
}
