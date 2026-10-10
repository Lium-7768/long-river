'use client';

import { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { Kinship } from '@/lib/api';

/**
 * 3D 亲属关系星群（Three.js）。
 * 中心=本人；亲属按类别分布在球面扇区；可旋转缩放；点节点开抽屉。
 */

type Category = 'ancestor' | 'descendant' | 'sibling' | 'spouse' | 'affine' | 'other';

const CAT_META: Record<Category, { label: string; color: string }> = {
  ancestor: { label: '长辈 / 祖先', color: '#7dd3fc' },
  descendant: { label: '晚辈 / 后裔', color: '#6ee7b7' },
  sibling: { label: '同辈 / 兄弟', color: '#fbbf24' },
  spouse: { label: '配偶', color: '#f472b6' },
  affine: { label: '姻亲', color: '#a78bfa' },
  other: { label: '其他亲属', color: '#94a3b8' },
};

function classify(rel: string): Category {
  const t = rel
    .replace(/[（(]反向[）)]/g, '')
    .split(';')[0]
    .trim()
    .replace(/從/g, '从')
    .replace(/姪/g, '侄')
    .replace(/孫/g, '孙');
  if (/父|母|祖|曾祖|高祖|太曾|先祖|直系祖先/.test(t)) return 'ancestor';
  if (/子|孙|後?后裔|裔|女$/.test(t) && !/妻|父/.test(t)) return 'descendant';
  if (/兄|弟|姊妹|姐|从兄|从弟|表/.test(t)) return 'sibling';
  if (/妻|丈夫|夫|妾|继室|正室/.test(t)) return 'spouse';
  if (/岳|丈人|女婿|媳|妻父|姻/.test(t)) return 'affine';
  return 'other';
}

interface Node {
  id: string;
  name: string;
  cat: Category;
  pos: [number, number, number];
}

function buildNodes(kinships: Kinship[]): Node[] {
  const clean = kinships.filter(
    (k) => k.name && !/^[A-Za-z0-9?？]{1,2}$/.test(k.name) && !k.name.includes('?'),
  );
  const byCat = new Map<Category, Kinship[]>();
  for (const k of clean) {
    const c = classify(k.rel);
    if (!byCat.has(c)) byCat.set(c, []);
    byCat.get(c)!.push(k);
  }
  const order: Category[] = ['ancestor', 'descendant', 'sibling', 'spouse', 'affine', 'other'];
  const present = order.filter((c) => byCat.has(c));
  const nodes: Node[] = [];
  const R = 6;

  present.forEach((cat, ci) => {
    const items = byCat.get(cat)!;
    const show = items.slice(0, 26);
    const n = show.length || 1;
    const sectorCenter = (ci / present.length) * Math.PI * 2 - Math.PI / 2;
    const sectorSpan = ((Math.PI * 2) / present.length) * 0.8;
    show.forEach((k, i) => {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const ang = sectorCenter + (t - 0.5) * sectorSpan;
      const rr = R * (0.9 + (i % 4) * 0.05);
      // 轻微上下错落，形成 3D 层次
      const yy = ((i % 5) - 2) * 0.55;
      nodes.push({
        id: k.id,
        name: k.name,
        cat,
        pos: [Math.cos(ang) * rr, yy, Math.sin(ang) * rr],
      });
    });
  });
  return nodes;
}

function KinshipNode({
  node,
  onPick,
  onHover,
}: {
  node: Node;
  onPick: (id: string, name: string) => void;
  onHover: (id: string | null) => void;
}) {
  const [hover, setHover] = useState(false);
  const ref = useRef<THREE.Group>(null);
  const color = CAT_META[node.cat].color;

  useFrame(({ camera }) => {
    // 名字朝向相机（billboard）
    if (ref.current) ref.current.quaternion.copy(camera.quaternion);
  });

  return (
    <group position={node.pos}>
      <group ref={ref}>
        {/* 只展示文字：无圆点。透明球做点击热区 */}
        <mesh
          visible={false}
          onPointerOver={(e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation();
            setHover(true);
            onHover(node.id);
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            setHover(false);
            onHover(null);
            document.body.style.cursor = 'default';
          }}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            onPick(node.id, node.name);
          }}
        >
          <sphereGeometry args={[0.34, 10, 10]} />
        </mesh>
        {/* 彩色姓名文字（始终面向相机）*/}
        <Text
          fontSize={hover ? 0.46 : 0.38}
          color={hover ? '#ffffff' : color}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#03060f"
        >
          {node.name}
        </Text>
      </group>
    </group>
  );
}

function SelfNode() {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ camera }) => {
    if (ref.current) ref.current.quaternion.copy(camera.quaternion);
  });
  return (
    <group ref={ref}>
      <Text
        fontSize={0.5}
        color="#38bdf8"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#03060f"
      >
        本人
      </Text>
    </group>
  );
}

function Links({ nodes }: { nodes: Node[] }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const arr: number[] = [];
    for (const n of nodes) {
      arr.push(0, 0, 0, n.pos[0], n.pos[1], n.pos[2]);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    return g;
  }, [nodes]);
  const mat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: '#334155',
        transparent: true,
        opacity: 0.35,
      }),
    [],
  );
  const lines = useMemo(() => new THREE.LineSegments(geo, mat), [geo, mat]);
  return <primitive object={lines} />;
}

function Scene({
  nodes,
  onPick,
  onHover,
}: {
  nodes: Node[];
  onPick: (id: string, name: string) => void;
  onHover: (id: string | null) => void;
}) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <SelfNode />
      <Links nodes={nodes} />
      {nodes.map((n, i) => (
        <KinshipNode key={`${n.id}-${n.name}-${i}`} node={n} onPick={onPick} onHover={onHover} />
      ))}
      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={9}
        maxDistance={26}
      />
      <EffectComposer multisampling={0}>
        <Bloom
          intensity={0.7}
          luminanceThreshold={0.4}
          luminanceSmoothing={0.4}
          mipmapBlur
          radius={0.7}
        />
      </EffectComposer>
    </>
  );
}

export function KinshipGraph3D({
  kinships,
  onPick,
}: {
  kinships: Kinship[];
  onPick?: (id: string, name: string) => void;
}) {
  const [, setHovered] = useState<string | null>(null);
  const nodes = useMemo(() => buildNodes(kinships), [kinships]);

  // 图例
  const cats = useMemo(() => {
    const m = new Map<Category, number>();
    for (const k of kinships) {
      const c = classify(k.rel);
      m.set(c, (m.get(c) ?? 0) + 1);
    }
    return [...m.entries()];
  }, [kinships]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs">
        {cats.map(([cat, count]) => (
          <span key={cat} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: CAT_META[cat].color }}
            />
            <span className="text-white/50">
              {CAT_META[cat].label} {count}
            </span>
          </span>
        ))}
        <span className="text-white/25">拖拽旋转 · 滚轮缩放 · 点击查看详情</span>
      </div>
      <div className="h-[440px] w-full overflow-hidden rounded-xl border border-white/10 bg-[#04070e]">
        <Canvas
          camera={{ position: [0, 4, 13], fov: 50 }}
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
          dpr={[1, 1.75]}
        >
          <color attach="background" args={['#04070e']} />
          <Scene nodes={nodes} onPick={(id, name) => onPick?.(id, name)} onHover={setHovered} />
        </Canvas>
      </div>
      <div className="mt-2 text-center text-[11px] text-white/30">
        共 {kinships.length} 条亲属 · 节点按关系类别着色
      </div>
    </div>
  );
}
