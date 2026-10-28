// Geographic projection helpers.
//
// The campus spans ~1.5 km, so a local equirectangular projection around the
// campus centre is accurate to well under a metre and keeps the 3D scene in
// plain metric units. North maps to -Z (three.js convention: camera looking
// down -Z at the origin sees north "up").

export interface LatLon {
  lat: number;
  lon: number;
}

const METERS_PER_DEG_LAT = 110574;
const METERS_PER_DEG_LON = 111320;

export function makeProjector(center: LatLon) {
  const cosLat = Math.cos((center.lat * Math.PI) / 180);

  /** [lat, lon] -> scene [x, z] in metres. */
  function project(lat: number, lon: number): [number, number] {
    return [
      (lon - center.lon) * METERS_PER_DEG_LON * cosLat,
      -(lat - center.lat) * METERS_PER_DEG_LAT,
    ];
  }

  /** scene [x, z] -> { lat, lon }. */
  function unproject(x: number, z: number): LatLon {
    return {
      lat: center.lat - z / METERS_PER_DEG_LAT,
      lon: center.lon + x / (METERS_PER_DEG_LON * cosLat),
    };
  }

  return { project, unproject, center };
}

export type Projector = ReturnType<typeof makeProjector>;

/** Great-circle-free approximate distance in metres (fine at campus scale). */
export function distMeters(aLat: number, aLon: number, bLat: number, bLon: number, cosLat: number): number {
  const dLat = (bLat - aLat) * METERS_PER_DEG_LAT;
  const dLon = (bLon - aLon) * METERS_PER_DEG_LON * cosLat;
  return Math.sqrt(dLat * dLat + dLon * dLon);
}
