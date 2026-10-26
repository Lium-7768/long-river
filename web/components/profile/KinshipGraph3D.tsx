'use client';

import { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { Kinship } from '@/lib/api';
import { useWebGLAvailable } from '@/lib/webgl';
import { getStarTexture } from '@/components/river/starTexture';

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
  const R = 9.5;

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
      const yy = ((i % 6) - 2.5) * 1.35;
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
        {/* 星点：柔光 sprite + 细小核，让节点像"星"而不是纯文字 */}
        <sprite scale={hover ? [1.5, 1.5, 1] : [1.0, 1.0, 1]}>
          <spriteMaterial
            map={getStarTexture()}
            color={color}
            transparent
            opacity={hover ? 0.95 : 0.55}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>
        <mesh>
          <sphereGeometry args={[0.07, 10, 10]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
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
          fontSize={hover ? 0.62 : 0.52}
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
        opacity: 0,
      }),
    [],
  );
  const lines = useMemo(() => new THREE.LineSegments(geo, mat), [geo, mat]);

  // 连线生长：进入视野后 1.4s 淡入，配合星点形成"星图织成"的感觉
  const t0 = useRef<number | null>(null);
  useFrame(({ clock }) => {
    if (t0.current === null) t0.current = clock.elapsedTime;
    const k = Math.min(1, (clock.elapsedTime - t0.current) / 1.4);
    mat.opacity = 0.06 + k * 0.3;
  });

  return <primitive object={lines} />;
}

/** 星尘：球壳内散布的微光粒子，缓慢自转，作为星图背景 */
function StarDust({ radius = 26, count = 900 }: { radius?: number; count?: number }) {
  const geom = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const palette = [
      new THREE.Color(0.72, 0.78, 0.95),
      new THREE.Color(0.95, 0.91, 0.82),
      new THREE.Color(0.86, 0.72, 0.55),
      new THREE.Color(0.62, 0.76, 0.88),
    ];
    for (let i = 0; i < count; i++) {
      let x: number, y: number, z: number, r: number;
      do {
        x = Math.random() * 2 - 1;
        y = Math.random() * 2 - 1;
        z = Math.random() * 2 - 1;
        r = Math.hypot(x, y, z);
      } while (r > 1 || r < 0.35);
      const R = radius * (0.55 + Math.random() * 0.45);
      pos[i * 3] = (x / r) * R;
      pos[i * 3 + 1] = (y / r) * R * 0.72;
      pos[i * 3 + 2] = (z / r) * R;
      const c = palette[i % palette.length];
      const dim = 0.35 + Math.random() * 0.65;
      col[i * 3] = c.r * dim;
      col[i * 3 + 1] = c.g * dim;
      col[i * 3 + 2] = c.b * dim;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }, [radius, count]);

  const ref = useRef<THREE.Points>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.elapsedTime * 0.02;
      ref.current.rotation.x = Math.sin(clock.elapsedTime * 0.05) * 0.05;
    }
  });

  return (
    <points ref={ref} geometry={geom} frustumCulled={false}>
      <pointsMaterial
        size={0.42}
        map={getStarTexture()}
        vertexColors
        transparent
        opacity={0.75}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
        toneMapped={false}
      />
    </points>
  );
}

/** 中心核：本人位置的一团呼吸光，给整图一个视觉重心 */
function CoreGlow() {
  const ref = useRef<THREE.Sprite>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const k = 1 + Math.sin(clock.elapsedTime * 1.6) * 0.12;
    ref.current.scale.set(3.4 * k, 3.4 * k, 1);
    (ref.current.material as THREE.SpriteMaterial).opacity = 0.5 + Math.sin(clock.elapsedTime * 1.6) * 0.12;
  });
  return (
    <sprite ref={ref} scale={[3.4, 3.4, 1]}>
      <spriteMaterial
        map={getStarTexture()}
        color="#38bdf8"
        transparent
        opacity={0.5}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </sprite>
  );
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
      <StarDust />
      <CoreGlow />
      <SelfNode />
      <Links nodes={nodes} />
      {nodes.map((n, i) => (
        <KinshipNode key={`${n.id}-${n.name}-${i}`} node={n} onPick={onPick} onHover={onHover} />
      ))}
      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={12}
        maxDistance={40}
      />
      <EffectComposer multisampling={0}>
        <Bloom
          intensity={0.95}
          luminanceThreshold={0.32}
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
  const webgl = useWebGLAvailable();

  // 图例
  const cats = useMemo(() => {
    const m = new Map<Category, number>();
    for (const k of kinships) {
      const c = classify(k.rel);
      m.set(c, (m.get(c) ?? 0) + 1);
    }
    return [...m.entries()];
  }, [kinships]);

  // 无 WebGL → 2D 回退（仍可点开每个人）
  if (webgl === false) {
    return (
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-3 text-base">
          {cats.map(([cat, count]) => (
            <span key={cat} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: CAT_META[cat].color }}
              />
              <span className="text-white/50">
                {cat} {count}
              </span>
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {kinships.map((k, i) => (
            <button
              key={`${k.id}-${i}`}
              onClick={() => onPick?.(k.id, k.name)}
              className="cursor-pointer rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-base text-white/80 transition hover:border-sky-400/40 hover:bg-sky-400/[0.08]"
            >
              <span className="text-white/40">{k.rel}·</span>
              {k.name}
            </button>
          ))}
        </div>
        <p className="mt-2 text-base text-white/30">当前环境不支持 3D，已用列表展示。</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-base">
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
      <div className="h-[520px] w-full overflow-hidden rounded-xl border border-white/10 bg-[#04070e]">
        <Canvas
          camera={{ position: [0, 3, 20], fov: 50 }}
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
          dpr={[1, 1.75]}
        >
          <color attach="background" args={['#04070e']} />
          <Scene nodes={nodes} onPick={(id, name) => onPick?.(id, name)} onHover={setHovered} />
        </Canvas>
      </div>
      <div className="mt-2 text-center text-base text-white/30">
        共 {kinships.length} 条亲属 · 节点按关系类别着色
      </div>
    </div>
  );
}
