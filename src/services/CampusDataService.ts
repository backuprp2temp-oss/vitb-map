// CampusDataService — single source of truth for bundled campus data.
// Loads the normalized JSON datasets produced by scripts/import-osm.mjs,
// exposes typed accessors, and derives positions/building attachments.

import campusMetaJson from "@/data/campus/campus.json";
import buildingsJson from "@/data/campus/buildings.json";
import poisJson from "@/data/campus/points-of-interest.json";
import pathsJson from "@/data/campus/paths.json";
import areasJson from "@/data/campus/areas.json";
import type { AreaFeature, Building, CampusMeta, PathFeature, Place } from "@/types/campus";
import { makeProjector, type Projector } from "./projection";

export const campusMeta = campusMetaJson as unknown as CampusMeta;
export const buildings = buildingsJson as unknown as Building[];
export const pois = poisJson as unknown as Place[];
export const paths = pathsJson as unknown as PathFeature[];
export const areas = areasJson as unknown as AreaFeature[];

export const projector: Projector = makeProjector(campusMeta.center);

const buildingById = new Map(buildings.map((b) => [b.id, b]));

const centroidCache = new Map<string, { lat: number; lon: number }>();
export function buildingCentroid(b: Building): { lat: number; lon: number } {
  const cached = centroidCache.get(b.id);
  if (cached) return cached;
  let lat = 0;
  let lon = 0;
  for (const [la, lo] of b.polygon) {
    lat += la;
    lon += lo;
  }
  const n = Math.max(b.polygon.length, 1);
  const c = { lat: lat / n, lon: lon / n };
  centroidCache.set(b.id, c);
  return c;
}

export function buildingByIdOr(id: string | null | undefined): Building | null {
  if (!id) return null;
  return buildingById.get(id) ?? null;
}

/** Best-known position for a place (own coordinates, else its building). */
export function placePosition(place: Place | null): { lat: number; lon: number } | null {
  if (!place) return null;
  if (place.lat != null && place.lon != null) return { lat: place.lat, lon: place.lon };
  const b = buildingByIdOr(place.insideBuildingId);
  return b ? buildingCentroid(b) : null;
}

export function placeBuilding(place: Place | null): Building | null {
  if (!place) return null;
  return buildingByIdOr(place.insideBuildingId);
}

/** All POIs that sit inside / are attached to a building. */
export function poisOfBuilding(buildingId: string): Place[] {
  return pois.filter((p) => p.insideBuildingId === buildingId);
}

/** Every searchable entry: buildings + POIs, with resolved positions. */
export interface SearchablePlace {
  id: string;
  kind: "building" | "poi";
  name: string;
  commonName?: string | null;
  aliases: string[];
  category: string;
  subcategory?: string | null;
  lat: number | null;
  lon: number | null;
  /** Building id when this entry is a POI attached to a building. */
  buildingId: string | null;
  place: Building | Place;
}

export const searchablePlaces: SearchablePlace[] = [
  ...buildings.map((b) => {
    const c = buildingCentroid(b);
    return {
      id: b.id,
      kind: "building" as const,
      name: b.name,
      commonName: b.commonName ?? null,
      aliases: b.aliases ?? [],
      category: b.category,
      subcategory: b.subcategory ?? null,
      lat: c.lat,
      lon: c.lon,
      buildingId: b.id,
      place: b,
    };
  }),
  ...pois.map((p) => {
    const pos = placePosition(p);
    return {
      id: p.id,
      kind: "poi" as const,
      name: p.name,
      commonName: p.commonName ?? null,
      aliases: p.aliases ?? [],
      category: p.category,
      subcategory: p.subcategory ?? null,
      lat: pos ? pos.lat : null,
      lon: pos ? pos.lon : null,
      buildingId: p.insideBuildingId ?? null,
      place: p,
    };
  }),
];

export function searchableById(id: string | null | undefined): SearchablePlace | null {
  if (!id) return null;
  return searchablePlaces.find((s) => s.id === id) ?? null;
}

/** Centroid of all buildings — the default camera target (the actual built
 *  campus centre, not the raw university-node coordinate). */
export const campusViewCenter: [number, number] = (() => {
  if (buildings.length === 0) {
    return projector.project(campusMeta.center.lat, campusMeta.center.lon);
  }
  let x = 0;
  let z = 0;
  for (const b of buildings) {
    const c = buildingCentroid(b);
    const [px, pz] = projector.project(c.lat, c.lon);
    x += px;
    z += pz;
  }
  return [x / buildings.length, z / buildings.length];
})();

/** Origin/destination snap point for routing for a searchable place. */
export function routingPoint(sp: SearchablePlace | null): { lat: number; lon: number } | null {
  if (!sp) return null;
  if (sp.kind === "building") {
    const b = sp.place as Building;
    if (b.entrance) return { lat: b.entrance.lat, lon: b.entrance.lon };
  }
  if (sp.lat != null && sp.lon != null) return { lat: sp.lat, lon: sp.lon };
  const b = buildingByIdOr(sp.buildingId);
  if (b) {
    if (b.entrance) return { lat: b.entrance.lat, lon: b.entrance.lon };
    return buildingCentroid(b);
  }
  return null;
}
