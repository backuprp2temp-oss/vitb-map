// Building meshes: real OSM footprints extruded by (known or estimated)
// heights. Light gray walls, restrained warm rooftops, emissive highlight for
// hover/selection. Labels via DOM overlays (crisp, styled, no font fetch).

import { useMemo } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import { buildings, projector, buildingCentroid } from "@/services/CampusDataService";
import { useMapStore } from "@/state/store";
import { ringToShape } from "./sceneUtils";

const WALL_COLORS: Record<string, string> = {
  academic: "#a9b0ba",
  hostel: "#b3aa9e",
  food: "#b0a49c",
  residence: "#a9b3a4",
  event: "#aeb4bd",
  service: "#a6adb5",
  study: "#aeb0ba",
  medical: "#adb2ba",
  campus: "#a9b0ba",
  facility: "#a6adb5",
  other: "#a4abb4",
};

const ROOF_COLORS: Record<string, string> = {
  academic: "#8a5a4e",
  hostel: "#77685a",
  food: "#8a5a4e",
  residence: "#75695e",
  event: "#8a5f52",
  service: "#7a6c60",
  study: "#8a5a4e",
  medical: "#8a5a4e",
  campus: "#8a5a4e",
  facility: "#7a6c60",
  other: "#7d7062",
};

function noRaycast() {
  return null as unknown as THREE.Object3D[];
}

interface BuildingMeshProps {
  index: number;
  shadows: boolean;
}

function BuildingMesh({ index, shadows }: BuildingMeshProps) {
  const building = buildings[index];
  const selectedId = useMapStore((s) => s.selectedId);
  const hoveredId = useMapStore((s) => s.hoveredId);
  const select = useMapStore((s) => s.select);
  const setHovered = useMapStore((s) => s.setHovered);
  const pickMode = useMapStore((s) => s.pickMode);
  const focusOn = useMapStore((s) => s.focusOn);

  const geometry = useMemo(() => {
    const shape = ringToShape(building.polygon, projector);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: building.heightM,
      bevelEnabled: false,
    });
    geometry.rotateX(-Math.PI / 2);
    return geometry;
  }, [building]);

  const centroid = useMemo(() => {
    const c = buildingCentroid(building);
    const [x, z] = projector.project(c.lat, c.lon);
    return { x, z };
  }, [building]);

  const isSelected = selectedId === building.id;
  const isHovered = hoveredId === building.id;
  const emissive = isSelected ? "#4f9cf9" : isHovered ? "#31506e" : "#000000";
  const emissiveIntensity = isSelected ? 0.5 : isHovered ? 0.3 : 0;

  const wallColor = WALL_COLORS[building.category] ?? WALL_COLORS.other;
  const roofColor = ROOF_COLORS[building.category] ?? ROOF_COLORS.other;

  const label = (building.commonName || building.name).slice(0, 26);
  const showLabel = building.name !== "Unnamed building";

  return (
    <group>
      <mesh
        geometry={geometry}
        castShadow={shadows}
        receiveShadow={shadows}
        raycast={pickMode ? noRaycast : undefined}
        onClick={(e) => {
          e.stopPropagation();
          select(building.id);
          focusOn(centroid.x, centroid.z);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(building.id);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(null);
          document.body.style.cursor = "auto";
        }}
      >
        <meshStandardMaterial
          attach="material-0"
          color={roofColor}
          roughness={0.95}
          metalness={0}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
        />
        <meshStandardMaterial
          attach="material-1"
          color={wallColor}
          roughness={0.9}
          metalness={0}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity * 0.7}
        />
      </mesh>
      {showLabel && (
        <Html
          position={[centroid.x, building.heightM + 10, centroid.z]}
          center
          distanceFactor={520}
          style={{ pointerEvents: "none" }}
          zIndexRange={[8, 0]}
        >
          <div
            className={`map-building-label${isSelected ? " selected" : ""}`}
          >
            {label}
          </div>
        </Html>
      )}
    </group>
  );
}

export function Buildings({ shadows }: { shadows: boolean }) {
  return (
    <group>
      {buildings.map((b, i) => (
        <BuildingMesh key={b.id} index={i} shadows={shadows} />
      ))}
    </group>
  );
}
