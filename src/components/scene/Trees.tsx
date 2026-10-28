// Decorative campus vegetation: instanced trunks + canopies scattered
// deterministically in open spaces (avoiding buildings, water, roads,
// sports grounds and parking). Instancing keeps this cheap; count scales
// down on low-powered devices.

import { useMemo } from "react";
import * as THREE from "three";
import { buildings, areas, paths, campusMeta, projector } from "@/services/CampusDataService";
import { mulberry32 } from "./sceneUtils";

function pointInRing(lat: number, lon: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [latI, lonI] = ring[i];
    const [latJ, lonJ] = ring[j];
    const intersect =
      latI > lat !== latJ > lat &&
      lon < ((lonJ - lonI) * (lat - latI)) / (latJ - latI) + lonI;
    if (intersect) inside = !inside;
  }
  return inside;
}

function isLowPowerDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const cores = navigator.hardwareConcurrency ?? 8;
  const coarse = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
  return cores <= 4 || coarse;
}

function scatterPositions(count: number): [number, number, number][] {
  const rand = mulberry32(20261009);
  const bbox = campusMeta.campusBbox;
  const margin = 0.004; // allow trees just beyond mapped features
  const south = bbox.south - margin;
  const north = bbox.north + margin;
  const west = bbox.west - margin;
  const east = bbox.east + margin;

  // Keep-out rings: buildings, water, sports grounds, parking.
  const keepOutRings: [number, number][][] = [
    ...buildings.map((b) => b.polygon),
    ...areas.filter((a) => a.kind !== "green").map((a) => a.coordinates),
  ];
  // Path/road coordinates for clearance checks.
  const pathCoords: [number, number][] = paths.flatMap((p) => p.coordinates);
  const cosLat = Math.cos((campusMeta.center.lat * Math.PI) / 180);
  const clearance = 6; // metres

  const out: [number, number, number][] = [];
  let attempts = 0;
  while (out.length < count && attempts < count * 12) {
    attempts++;
    const lat = south + rand() * (north - south);
    const lon = west + rand() * (east - west);
    if (keepOutRings.some((ring) => pointInRing(lat, lon, ring))) continue;
    let nearPath = false;
    for (const c of pathCoords) {
      const dLat = (c[0] - lat) * 110574;
      const dLon = (c[1] - lon) * 111320 * cosLat;
      if (dLat * dLat + dLon * dLon < clearance * clearance) {
        nearPath = true;
        break;
      }
    }
    if (nearPath) continue;
    const [x, z] = projector.project(lat, lon);
    out.push([x, z, 0.7 + rand() * 0.8]);
  }
  return out;
}

const tmpObj = new THREE.Object3D();
const tmpColor = new THREE.Color();

export function Trees() {
  const lowPower = useMemo(isLowPowerDevice, []);
  const count = lowPower ? 70 : 170;
  const trees = useMemo(() => scatterPositions(count), [count]);

  return (
    <group>
      <instancedMesh
        args={[undefined as unknown as THREE.BufferGeometry, undefined as unknown as THREE.Material, trees.length]}
        ref={(mesh) => {
          if (!mesh) return;
          trees.forEach((t, i) => {
            tmpObj.position.set(t[0], 1.2 * t[2], t[1]);
            tmpObj.scale.setScalar(t[2]);
            tmpObj.updateMatrix();
            mesh.setMatrixAt(i, tmpObj.matrix);
          });
          mesh.instanceMatrix.needsUpdate = true;
        }}
      >
        <cylinderGeometry args={[0.18, 0.28, 2.4, 5]} />
        <meshStandardMaterial color="#3a3226" roughness={1} />
      </instancedMesh>
      <instancedMesh
        args={[undefined as unknown as THREE.BufferGeometry, undefined as unknown as THREE.Material, trees.length]}
        ref={(mesh) => {
          if (!mesh) return;
          trees.forEach((t, i) => {
            tmpObj.position.set(t[0], 3.9 * t[2], t[1]);
            tmpObj.scale.setScalar(t[2]);
            tmpObj.updateMatrix();
            mesh.setMatrixAt(i, tmpObj.matrix);
            // Per-instance canopy color jitter.
            const jitter = mulberry32(i * 7919 + 13);
            tmpColor.setHSL(0.34 + jitter() * 0.05, 0.35 + jitter() * 0.12, 0.24 + jitter() * 0.09);
            mesh.setColorAt(i, tmpColor);
          });
          mesh.instanceMatrix.needsUpdate = true;
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        }}
      >
        <coneGeometry args={[1.6, 3.6, 7]} />
        <meshStandardMaterial color="#2e4a33" roughness={1} />
      </instancedMesh>
    </group>
  );
}
