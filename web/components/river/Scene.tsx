'use client';

import { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { DYNASTIES, DYNASTIES_WITH_DATA } from '@/content/dynasties';
import { riverCurve, DYNASTY_T, pointAt } from './curve';
import { useThemeColor } from '@/lib/use-theme-color';

/**
 * 滚动驱动的时间长河。
 * 相机沿 riverCurve 飞行，progress∈[0,1] 由外部滚动控制（用 ref 传入，避免重渲染）。
 */

const hasData = (id: string) => DYNASTIES_WITH_DATA.has(id);

/* ---------- 河道：沿曲线的一串光带 + 粒子 ---------- */
function RiverRibbon() {
  const accent = useThemeColor('--lr-accent', [0.15, 0.7, 1]);

  const { lineGeom, particleGeom } = useMemo(() => {
    const N = 240;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= N; i++) pts.push(riverCurve.getPointAt(i / N));
    const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);

    // 河道两侧的浮尘
    const count = 2400;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const t = Math.random();
      const p = riverCurve.getPointAt(t);
      const spread = 3.5;
      arr[i * 3] = p.x + (Math.random() - 0.5) * spread;
      arr[i * 3 + 1] = p.y + (Math.random() - 0.5) * 1.2;
      arr[i * 3 + 2] = p.z + (Math.random() - 0.5) * spread;
    }
    const particleGeom = new THREE.BufferGeometry();
    particleGeom.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return { lineGeom, particleGeom };
  }, []);

  const lineObj = useMemo(() => {
    const mat = new THREE.LineBasicMaterial({
      color: new THREE.Color(accent[0], accent[1], accent[2]),
      transparent: true,
      opacity: 0.4,
      toneMapped: false,
    });
    return new THREE.Line(lineGeom, mat);
  }, [lineGeom, accent]);

  useFrame(({ clock }) => {
    const m = lineObj.material as THREE.LineBasicMaterial;
    m.opacity = 0.35 + Math.sin(clock.elapsedTime * 1.5) * 0.12;
  });

  return (
    <group>
      <primitive object={lineObj} />
      <points geometry={particleGeom}>
        <pointsMaterial
          size={0.05}
          color={new THREE.Color(accent[0], accent[1], accent[2])}
          transparent
          opacity={0.55}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation
          toneMapped={false}
        />
      </points>
    </group>
  );
}

/* ---------- 单个朝代节点 ---------- */
function DynastyNode({ index, onPick }: { index: number; onPick: (i: number) => void }) {
  const d = DYNASTIES[index];
  const usable = hasData(d.id);
  const accent = useThemeColor('--lr-accent', [0.15, 0.7, 1]);
  const accent2 = useThemeColor('--lr-accent-2', [0.5, 0.35, 1]);
  const [hover, setHover] = useState(false);
  const g = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);

  const t = DYNASTY_T[index];
  const base = useMemo(() => pointAt(t), [t]);
  const next = useMemo(() => pointAt(Math.min(t + 0.02, 1)), [t]);
  const tangent = useMemo(() => next.clone().sub(base).normalize(), [base, next]);

  const col = usable ? accent : [0.35, 0.42, 0.55];
  const color = new THREE.Color(col[0], col[1], col[2]);

  useFrame(({ clock }) => {
    if (g.current) g.current.rotation.y = Math.sin(clock.elapsedTime * 0.5 + index) * 0.15;
    if (ring.current) ring.current.rotation.z = clock.elapsedTime * (usable ? 0.6 : 0.15);
  });

  // 朝向：让碑面大致垂直于河的切线
  const yaw = Math.atan2(tangent.x, tangent.z);

  return (
    <group position={base} rotation={[0, yaw, 0]}>
      <group ref={g}>
        {/* 主碑：细高的晶体 */}
        <mesh
          position={[0, usable ? 0.9 : 0.4, 0]}
          onPointerOver={(e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation();
            setHover(true);
            document.body.style.cursor = usable ? 'pointer' : 'default';
          }}
          onPointerOut={() => {
            setHover(false);
            document.body.style.cursor = 'default';
          }}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            if (usable) onPick(index);
          }}
        >
          <octahedronGeometry args={[usable ? 0.55 : 0.3, 0]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={usable ? (hover ? 1.4 : 0.6) : 0.1}
            roughness={0.15}
            metalness={0.7}
            toneMapped={false}
          />
        </mesh>
        {/* 旋转光环 */}
        <mesh ref={ring} position={[0, usable ? 0.9 : 0.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[usable ? 0.9 : 0.5, 0.02, 8, 48]} />
          <meshBasicMaterial
            color={new THREE.Color(accent2[0], accent2[1], accent2[2])}
            transparent
            opacity={usable ? 0.6 : 0.15}
            toneMapped={false}
          />
        </mesh>
      </group>
      {/* 名字 */}
      <Text
        position={[0, usable ? 1.9 : 1.1, 0]}
        fontSize={0.42}
        color={usable ? '#e8f4ff' : '#5e6f88'}
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.006}
        outlineColor="#03060f"
      >
        {d.name}
      </Text>
      <Text position={[0, -0.35, 0]} fontSize={0.2} color="#7b8aa8" anchorX="center" anchorY="top">
        {`${d.start < 0 ? '前' + -d.start : d.start}`}
      </Text>
    </group>
  );
}

/* ---------- 相机飞行（核心）---------- */
function CameraRig({ progress }: { progress: React.MutableRefObject<number> }) {
  const { camera } = useThree();
  const lookAt = useRef(new THREE.Vector3());
  const pos = useRef(new THREE.Vector3());
  const mouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  useFrame((_, dt) => {
    const t = THREE.MathUtils.clamp(progress.current, 0, 1);
    // 相机位于曲线当前点稍后一点，向前看
    const p = pointAt(t);
    const ahead = pointAt(Math.min(t + 0.06, 1));

    // 期望位置：河道上方 + 侧向，随鼠标轻微偏移
    const desired = new THREE.Vector3(
      p.x + mouse.current.x * 1.4,
      p.y + 1.6 - mouse.current.y * 0.6,
      p.z + 3.2,
    );
    // 缓动（惯性）
    const k = 1 - Math.exp(-6 * dt);
    pos.current.lerp(desired, k);
    camera.position.copy(pos.current);

    lookAt.current.lerp(new THREE.Vector3(ahead.x, ahead.y + 0.6, ahead.z), k);
    camera.lookAt(lookAt.current);
  });

  return null;
}

export function Scene({
  progress,
  onPick,
}: {
  progress: React.MutableRefObject<number>;
  onPick: (i: number) => void;
}) {
  return (
    <>
      <color attach="background" args={['#03060f']} />
      <fog attach="fog" args={['#03060f', 18, 55]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[5, 10, 5]} intensity={0.7} />
      <RiverRibbon />
      {DYNASTIES.map((_, i) => (
        <DynastyNode key={i} index={i} onPick={onPick} />
      ))}
      <CameraRig progress={progress} />
    </>
  );
}
