// POI markers: floating pins colored by category, with labels, hover
// highlight, selection pulse and click-to-inspect. Building-attached POIs
// without their own coordinates render at their building's centroid.

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { pois, projector, placePosition } from "@/services/CampusDataService";
import { useMapStore } from "@/state/store";
import { categoryMeta } from "@/data/categories";

function noRaycast() {
  return null as unknown as THREE.Object3D[];
}

interface PoiPinProps {
  index: number;
}

function PoiPin({ index }: PoiPinProps) {
  const poi = pois[index];
  const selectedId = useMapStore((s) => s.selectedId);
  const hoveredId = useMapStore((s) => s.hoveredId);
  const select = useMapStore((s) => s.select);
  const setHovered = useMapStore((s) => s.setHovered);
  const pickMode = useMapStore((s) => s.pickMode);
  const focusOn = useMapStore((s) => s.focusOn);
  const ringRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);

  const pos = placePosition(poi);
  const meta = categoryMeta(poi.category);
  const isSelected = selectedId === poi.id;
  const isHovered = hoveredId === poi.id;

  useFrame(({ clock }) => {
    if (ringRef.current) {
      const t = clock.getElapsedTime();
      const s = 1 + 0.25 * Math.sin(t * 3);
      ringRef.current.scale.setScalar(s);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = 0.55 + 0.25 * Math.sin(t * 3);
    }
    if (groupRef.current) {
      const target = isHovered ? 1.25 : 1;
      groupRef.current.scale.lerp(new THREE.Vector3(target, target, target), 0.2);
    }
  });

  if (!pos) return null;
  const [x, z] = projector.project(pos.lat, pos.lon);
  const attached = !poi.lat; // no own coordinates — rendered at building centroid

  return (
    <group position={[x, 0, z]}>
      <group ref={groupRef}>
        <mesh
          position={[0, attached ? 3.4 : 2.6, 0]}
          raycast={pickMode ? noRaycast : undefined}
          onClick={(e) => {
            e.stopPropagation();
            select(poi.id);
            focusOn(x, z);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(poi.id);
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            setHovered(null);
            document.body.style.cursor = "auto";
          }}
        >
          {attached ? (
            <octahedronGeometry args={[2.2, 0]} />
          ) : (
            <sphereGeometry args={[2, 16, 14]} />
          )}
          <meshStandardMaterial
            color={meta.color}
            emissive={meta.color}
            emissiveIntensity={isSelected ? 0.9 : isHovered ? 0.7 : 0.5}
            roughness={0.4}
          />
        </mesh>
        {!attached && (
          <mesh position={[0, 1.6, 0]}>
            <cylinderGeometry args={[0.14, 0.14, 3.2, 6]} />
            <meshStandardMaterial color="#6b7684" roughness={0.8} />
          </mesh>
        )}
      </group>
      {isSelected && (
        <mesh ref={ringRef} position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[3.2, 4.2, 32]} />
          <meshBasicMaterial color={meta.color} transparent opacity={0.7} side={THREE.DoubleSide} />
        </mesh>
      )}
      <Html
        position={[0, attached ? 6.4 : 5.2, 0]}
        center
        distanceFactor={420}
        style={{ pointerEvents: "none" }}
        zIndexRange={[9, 0]}
      >
        <div className={`map-poi-label${isSelected ? " selected" : ""}`}>
          {poi.name.slice(0, 24)}
        </div>
      </Html>
    </group>
  );
}

export function PoiMarkers() {
  const visibleCategories = useMapStore((s) => s.visibleCategories);
  const indexes = useMemo(
    () =>
      pois
        .map((p, i) => ({ p, i }))
        .filter(({ p }) => visibleCategories[p.category] !== false)
        .map(({ i }) => i),
    [visibleCategories]
  );
  return (
    <group>
      {indexes.map((i) => (
        <PoiPin key={pois[i].id} index={i} />
      ))}
    </group>
  );
}
