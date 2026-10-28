// Scene utilities: ring winding, shape building, ribbon geometry, PRNG.

import * as THREE from "three";
import type { Projector } from "@/services/projection";

/** Ensure a projected ring is counter-clockwise (for correct normals). */
export function ensureCCW(ring: [number, number][]): [number, number][] {
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    area += ring[i][0] * ring[j][1] - ring[j][0] * ring[i][1];
  }
  return area < 0 ? [...ring].reverse() : ring;
}

/** Build a THREE.Shape from a [lat, lon] ring.
 *  Shape lives in the XY plane with y = -zScene so that rotating the extruded
 *  mesh by -90° about X stands it upright with correct north orientation. */
export function ringToShape(ring: [number, number][], projector: Projector): THREE.Shape {
  const ccw = ensureCCW(ring);
  const shape = new THREE.Shape();
  ccw.forEach(([lat, lon], i) => {
    const [x, z] = projector.project(lat, lon);
    if (i === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  });
  shape.closePath();
  return shape;
}

/** Flat polygon geometry (XY plane, y-up after rotateX(-PI/2)). */
export function ringToGeometry(ring: [number, number][], projector: Projector): THREE.BufferGeometry {
  const shape = ringToShape(ring, projector);
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

/** Build a flat ribbon (walking road) along a [lat, lon] polyline. */
export function ribbonGeometry(
  coords: [number, number][],
  width: number,
  projector: Projector
): THREE.BufferGeometry | null {
  if (coords.length < 2) return null;
  const positions: number[] = [];
  const indices: number[] = [];
  let v = 0;

  for (let i = 0; i + 1 < coords.length; i++) {
    const [x1, z1] = projector.project(coords[i][0], coords[i][1]);
    const [x2, z2] = projector.project(coords[i + 1][0], coords[i + 1][1]);
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.05) continue;
    // Perpendicular unit in XZ.
    const px = -dz / len;
    const pz = dx / len;
    const hw = width / 2;
    // Quad corners (y slightly above ground; caller sets final offset via mesh position).
    positions.push(
      x1 + px * hw, 0, z1 + pz * hw,
      x1 - px * hw, 0, z1 - pz * hw,
      x2 + px * hw, 0, z2 + pz * hw,
      x2 - px * hw, 0, z2 - pz * hw,
    );
    indices.push(v, v + 2, v + 1, v + 2, v + 3, v + 1);
    v += 4;
  }
  if (v === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Deterministic PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
