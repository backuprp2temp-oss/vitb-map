// Shared types for VITmap Bhopal campus data.

export type Verification = "official" | "community" | "estimated";

export interface SourceRef {
  label: string;
  url?: string;
  verification: Verification;
}

export interface FloorInfo {
  level: number;
  note?: string;
}

export interface Entrance {
  lat: number;
  lon: number;
  verification: Verification;
}

/** An extruded campus building (footprint + height + metadata). */
export interface Building {
  id: string;
  osmType: "way" | "rel" | null;
  osmId: number | null;
  name: string;
  commonName?: string | null;
  category: string;
  subcategory?: string | null;
  /** Footprint ring as [lat, lon] pairs. */
  polygon: [number, number][];
  /** Level count when published by OSM, else null. */
  levels: number | null;
  /** Estimated level count when OSM has none. */
  estimatedLevels: number | null;
  heightM: number;
  heightSource: string;
  entrance?: Entrance | null;
  floors?: FloorInfo[];
  floorsNote?: string | null;
  aliases: string[];
  sources: SourceRef[];
  note?: string | null;
  updatedAt: string;
}

/** A point of interest (facility, food outlet, sports court, etc). */
export interface Place {
  id: string;
  osmType: "node" | null;
  osmId: number | null;
  name: string;
  commonName?: string | null;
  category: string;
  subcategory?: string | null;
  lat: number | null;
  lon: number | null;
  /** Building this place sits inside / is attached to. */
  insideBuildingId?: string | null;
  /** Identifier for the mess-menu subsystem. */
  menuId?: string | null;
  aliases: string[];
  verification: Verification;
  sources: SourceRef[];
  note?: string | null;
  updatedAt: string;
}

export interface PathFeature {
  id: string;
  name: string | null;
  kind: "road" | "path";
  osmClass: string;
  walkable: boolean;
  coordinates: [number, number][];
}

export interface AreaFeature {
  id: string;
  name: string | null;
  kind: "water" | "green" | "sports" | "parking";
  osmClass: string;
  coordinates: [number, number][];
}

export interface CampusMeta {
  name: string;
  shortName: string;
  center: { lat: number; lon: number };
  campusBbox: { south: number; west: number; north: number; east: number };
  attribution: { label: string; url: string }[];
  heightAssumption: string;
  walkingSpeedMps: number;
  importedAt: string;
  source: string;
}

/** A turn-by-turn instruction for a walking route. */
export interface RouteStep {
  instruction: string;
  distanceM: number;
}

export interface RouteResult {
  /** Ordered path as [lat, lon] pairs (origin → destination). */
  path: [number, number][];
  distanceM: number;
  durationS: number;
  steps: RouteStep[];
}
