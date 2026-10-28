// Route overlay: animated dashed walking route + origin/destination discs.

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMapStore } from "@/state/store";
import { projector } from "@/services/CampusDataService";

export function RouteLine() {
  const route = useMapStore((s) => s.route);
  const materialRef = useRef<THREE.Material | null>(null);

  const points = useMemo(() => {
    if (!route || route.path.length < 2) return null;
    return route.path.map(([lat, lon]) => {
      const [x, z] = projector.project(lat, lon);
      return new THREE.Vector3(x, 0.25, z);
    });
  }, [route]);

  useFrame((_, dt) => {
    const mat = materialRef.current as unknown as { dashOffset?: number } | null;
    if (mat && typeof mat.dashOffset === "number") {
      mat.dashOffset -= dt * 2.2;
    }
  });

  if (!points) return null;
  const origin = points[0];
  const dest = points[points.length - 1];

  return (
    <group>
      <Line
        points={points}
        color="#ffb454"
        lineWidth={4}
        dashed
        dashSize={7}
        gapSize={5}
        transparent
        opacity={0.95}
        ref={(line) => {
          // three-stdlib Line2 → LineMaterial
          const mat = (line?.material ?? null) as THREE.Material | null;
          materialRef.current = mat;
        }}
      />
      <mesh position={[origin.x, 0.12, origin.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[3.4, 24]} />
        <meshBasicMaterial color="#4ade80" transparent opacity={0.9} />
      </mesh>
      <mesh position={[dest.x, 0.14, dest.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[3.4, 24]} />
        <meshBasicMaterial color="#ffb454" transparent opacity={0.95} />
      </mesh>
    </group>
  );
}
