// Water bodies, green spaces, sports grounds and parking rendered as flat
// polygons from verified OSM area features.

import { useMemo } from "react";
import { areas, projector } from "@/services/CampusDataService";
import { ringToGeometry } from "./sceneUtils";

const AREA_STYLE: Record<string, { color: string; roughness: number; metalness: number; y: number }> = {
  water: { color: "#16303d", roughness: 0.35, metalness: 0.25, y: 0.02 },
  green: { color: "#1b3125", roughness: 1, metalness: 0, y: 0.025 },
  sports: { color: "#20402b", roughness: 1, metalness: 0, y: 0.03 },
  parking: { color: "#1d222a", roughness: 1, metalness: 0, y: 0.035 },
};

export function AreasRenderer() {
  const meshes = useMemo(
    () =>
      areas
        .map((area) => {
          const style = AREA_STYLE[area.kind] ?? AREA_STYLE.green;
          const geometry = ringToGeometry(area.coordinates, projector);
          return { area, style, geometry };
        })
        .filter((m) => m.geometry != null),
    []
  );

  return (
    <group>
      {meshes.map(({ area, style, geometry }) => (
        <mesh key={area.id} geometry={geometry} position={[0, style.y, 0]}>
          <meshStandardMaterial
            color={style.color}
            roughness={style.roughness}
            metalness={style.metalness}
            transparent={area.kind === "water"}
            opacity={area.kind === "water" ? 0.9 : 1}
          />
        </mesh>
      ))}
    </group>
  );
}
