'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { getCoverage } from '@/content/territory/coverage';
import { useThemeColor } from '@/lib/use-theme-color';

/**
 * 主权疆域「示意地图」（Three.js）。
 * 用现代省份轮廓近似古代疆域：覆盖省份高亮，其余暗色。
 * ⚠️ 示意，非精确历史边界。
 */

interface GeoFeature {
  type: string;
  properties: { name: string; cp?: number[] };
  geometry: { type: string; coordinates: unknown };
}

// 经纬度 → 平面（简单墨卡托近似 + 居中缩放），中国范围 lng ~73-135, lat ~18-54
const LNG0 = 104;
const LAT0 = 36;
const SCALE = 0.28;

function project(lng: number, lat: number): [number, number] {
  const x = (lng - LNG0) * SCALE;
  const y = (lat - LAT0) * SCALE;
  return [x, y];
}

/** 把 GeoJSON 的一个 feature 转成 THREE.Shape（支持 Polygon / MultiPolygon）*/
function featureToShapes(f: GeoFeature): THREE.Shape[] {
  const shapes: THREE.Shape[] = [];
  const g = f.geometry;
  const ringsOf = (poly: number[][][]): [number, number][][] =>
    poly.map((ring) => ring.map(([lng, lat]) => project(lng, lat)));

  const build = (rings: [number, number][][]) => {
    if (!rings.length) return;
    const outer = rings[0];
    const shape = new THREE.Shape();
    outer.forEach(([x, y], i) => (i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)));
    for (let i = 1; i < rings.length; i++) {
      const hole = new THREE.Path();
      rings[i].forEach(([x, y], j) => (j === 0 ? hole.moveTo(x, y) : hole.lineTo(x, y)));
      shape.holes.push(hole);
    }
    shapes.push(shape);
  };

  if (g.type === 'Polygon') build(ringsOf(g.coordinates as number[][][]));
  else if (g.type === 'MultiPolygon')
    (g.coordinates as number[][][][]).forEach((poly) => build(ringsOf(poly)));
  return shapes;
}

function ProvinceMesh({
  feature,
  active,
  color,
  activeColor,
}: {
  feature: GeoFeature;
  active: boolean;
  color: THREE.Color;
  activeColor: THREE.Color;
}) {
  const geo = useMemo(() => {
    const shapes = featureToShapes(feature);
    const g = new THREE.ExtrudeGeometry(shapes, {
      depth: active ? 0.22 : 0.06,
      bevelEnabled: false,
    });
    g.rotateX(0); // 平面在 XY，稍后整体转
    g.computeBoundingSphere();
    return g;
  }, [feature, active]);

  const mat = useMemo(() => {
    if (active) {
      return new THREE.MeshBasicMaterial({
        color: activeColor,
        toneMapped: false,
      });
    }
    return new THREE.MeshStandardMaterial({
      color,
      emissive: new THREE.Color('#0a0f1a'),
      emissiveIntensity: 0.1,
      metalness: 0.15,
      roughness: 0.7,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.3,
    });
  }, [active, activeColor, color]);

  return (
    <mesh geometry={geo} material={mat} position={[0, 0, active ? 0 : -0.1]} frustumCulled={false}>
      {/* outline */}
    </mesh>
  );
}

function MapScene({ features, activeSet }: { features: GeoFeature[]; activeSet: Set<string> }) {
  const accent = useThemeColor('--lr-accent', [0.15, 0.7, 1]);
  const inactive = useMemo(() => new THREE.Color('#1a2436'), []);
  const activeColor = useMemo(() => new THREE.Color(accent[0], accent[1], accent[2]), [accent]);
  const grp = useRef<THREE.Group>(null);

  useFrame((_, dt) => {
    if (grp.current) grp.current.rotation.z += dt * 0.02;
  });

  // 整体：把 XY 平面转到躺平（-90° X），再加一点倾斜
  return (
    <group scale={1}>
      <group ref={grp}>
        {features.map((f) => (
          <ProvinceMesh
            key={f.properties.name}
            feature={f}
            active={activeSet.has(f.properties.name)}
            color={inactive}
            activeColor={activeColor}
          />
        ))}
      </group>
    </group>
  );
}

function CameraLook() {
  useFrame(({ camera }) => {
    camera.lookAt(0.8, 0, 0);
  });
  return null;
}

export function TerritoryMap({ dynastyId }: { dynastyId: string }) {
  const [features, setFeatures] = useState<GeoFeature[] | null>(null);
  const cov = getCoverage(dynastyId);

  useEffect(() => {
    fetch('/geo/china.json')
      .then((r) => r.json())
      .then((d) => setFeatures(d.features))
      .catch(() => setFeatures([]));
  }, []);

  const activeSet = useMemo(() => new Set(cov?.provinces ?? []), [cov]);

  if (!cov) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-white/40">
        该朝代暂无疆域示意数据
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#05080f]">
      <div className="h-[360px] w-full">
        {features ? (
          <Canvas
            camera={{ position: [0.8, 0, 11.5], fov: 45 }}
            gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
            dpr={[1, 1.75]}
          >
            <color attach="background" args={['#05080f']} />
            <ambientLight intensity={0.5} />
            <directionalLight position={[5, -5, 10]} intensity={1.2} />
            <MapScene features={features} activeSet={activeSet} />
            <CameraLook />
            <EffectComposer multisampling={0}>
              <Bloom
                intensity={0.25}
                luminanceThreshold={0.85}
                luminanceSmoothing={0.3}
                mipmapBlur
                radius={0.5}
              />
            </EffectComposer>
          </Canvas>
        ) : (
          <div className="flex h-full items-center justify-center text-white/30">地图载入中…</div>
        )}
      </div>
      {/* 图注 */}
      <div className="border-t border-white/10 px-5 py-3">
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-sky-400" />
            <span className="text-white/60">疆域内</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-white/20" />
            <span className="text-white/60">疆域外</span>
          </span>
          <span className="text-white/30">共 {cov.provinces.length} 省</span>
        </div>
        {cov.note && <p className="mt-2 text-xs leading-relaxed text-white/45">※ {cov.note}</p>}
        <p className="mt-1 text-[11px] text-white/25">
          示意图：以现代省份轮廓近似古代疆域，非精确历史边界。
        </p>
      </div>
    </div>
  );
}
