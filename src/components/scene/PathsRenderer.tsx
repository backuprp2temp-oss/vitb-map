// Roads and pedestrian paths rendered as flat ribbons.
// Widths by OSM class; roads darker, footpaths lighter.

import { useMemo } from "react";
import type * as THREE from "three";
import { paths, projector } from "@/services/CampusDataService";
import { ribbonGeometry } from "./sceneUtils";

const ROAD_WIDTH: Record<string, number> = {
  trunk: 8,
  trunk_link: 6,
  secondary: 6,
  secondary_link: 5,
  tertiary: 5.5,
  tertiary_link: 4.5,
  unclassified: 4.5,
  residential: 4.5,
  living_street: 4,
  service: 3.5,
  track: 3,
  footway: 1.8,
  path: 1.8,
  steps: 1.8,
  pedestrian: 2.2,
};

interface Ribbon {
  id: string;
  geometry: THREE.BufferGeometry;
  kind: "road" | "path";
}

export function PathsRenderer() {
  const ribbons = useMemo(() => {
    const out: Ribbon[] = [];
    for (const p of paths) {
      const width = ROAD_WIDTH[p.osmClass] ?? 4;
      const geometry = ribbonGeometry(p.coordinates, width, projector);
      if (geometry) out.push({ id: p.id, geometry, kind: p.kind });
    }
    return out;
  }, []);

  return (
    <group>
      {ribbons.map((r) => (
        <mesh
          key={r.id}
          geometry={r.geometry}
          position={[0, r.kind === "path" ? 0.05 : 0.03, 0]}
        >
          <meshStandardMaterial
            color={r.kind === "path" ? "#3a424e" : "#262c35"}
            roughness={1}
            metalness={0}
          />
        </mesh>
      ))}
    </group>
  );
}
