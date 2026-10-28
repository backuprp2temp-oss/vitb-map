// Campus dataset integrity tests: normalization, references, duplicates,
// verification statuses and honest data boundaries.

import { describe, it, expect } from "vitest";
import {
  campusMeta,
  buildings,
  pois,
  paths,
  areas,
  buildingByIdOr,
  placePosition,
  searchablePlaces,
} from "@/services/CampusDataService";
import { bundledMenus } from "@/data/menus";

const VERIFICATIONS = ["official", "community", "estimated"];

describe("Campus dataset", () => {
  it("has complete metadata", () => {
    expect(campusMeta.name).toBe("VIT Bhopal University");
    expect(campusMeta.center.lat).toBeCloseTo(23.0755, 4);
    expect(campusMeta.center.lon).toBeCloseTo(76.8498, 4);
    expect(campusMeta.walkingSpeedMps).toBeGreaterThan(0);
    expect(campusMeta.importedAt).toBeTruthy();
    expect(campusMeta.attribution.length).toBeGreaterThan(0);
    expect(campusMeta.attribution.some((a) => a.label.includes("OpenStreetMap"))).toBe(true);
  });

  it("has buildings with valid footprints and heights", () => {
    expect(buildings.length).toBeGreaterThan(10);
    const ids = new Set<string>();
    for (const b of buildings) {
      expect(b.id).toBeTruthy();
      expect(ids.has(b.id)).toBe(false);
      ids.add(b.id);
      expect(b.name).toBeTruthy();
      expect(b.polygon.length).toBeGreaterThanOrEqual(3);
      for (const [lat, lon] of b.polygon) {
        expect(lat).toBeGreaterThan(23.06);
        expect(lat).toBeLessThan(23.09);
        expect(lon).toBeGreaterThan(76.83);
        expect(lon).toBeLessThan(76.88);
      }
      expect(b.heightM).toBeGreaterThan(0);
      expect(b.levels !== null || b.estimatedLevels !== null).toBe(true);
      expect(b.heightSource).toBeTruthy();
      expect(b.sources.length).toBeGreaterThan(0);
    }
  });

  it("has POIs with valid categories and verification", () => {
    expect(pois.length).toBeGreaterThan(5);
    const ids = new Set<string>();
    for (const p of pois) {
      expect(p.id).toBeTruthy();
      expect(ids.has(p.id)).toBe(false);
      ids.add(p.id);
      expect(p.name).toBeTruthy();
      expect(p.category).toBeTruthy();
      expect(VERIFICATIONS).toContain(p.verification);
    }
  });

  it("resolves building attachments correctly", () => {
    const library = pois.find((p) => p.id === "central-library");
    expect(library).toBeDefined();
    expect(library!.insideBuildingId).toBe("osm-rel-16248225");
    expect(buildingByIdOr("osm-rel-16248225")).not.toBeNull();

    const mess = pois.find((p) => p.id === "osm-node-11515616398");
    expect(mess).toBeDefined();
    expect(buildingByIdOr(mess!.insideBuildingId ?? "")).not.toBeNull();
  });

  it("gives every POI a resolvable position", () => {
    for (const p of pois) {
      expect(placePosition(p)).not.toBeNull();
    }
  });

  it("indexes all buildings and POIs for search with unique ids", () => {
    const ids = new Set(searchablePlaces.map((s) => s.id));
    expect(ids.size).toBe(searchablePlaces.length);
    for (const sp of searchablePlaces) {
      expect(sp.name).toBeTruthy();
      expect(sp.category).toBeTruthy();
    }
  });

  it("has walkable paths with coordinates", () => {
    expect(paths.length).toBeGreaterThan(50);
    for (const p of paths) {
      expect(p.walkable).toBeDefined();
      expect(p.coordinates.length).toBeGreaterThanOrEqual(2);
      expect(["road", "path"]).toContain(p.kind);
    }
  });

  it("has valid area features", () => {
    expect(areas.length).toBeGreaterThan(3);
    for (const a of areas) {
      expect(["water", "green", "sports", "parking"]).toContain(a.kind);
      expect(a.coordinates.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("includes the verified campus water body (Lasudiyakhaas Talab)", () => {
    expect(areas.some((a) => a.name === "Lasudiyakhaas Talab" && a.kind === "water")).toBe(true);
  });

  it("keeps menu outlets in sync with POI menuIds", () => {
    const outletIds = new Set(bundledMenus.outlets.map((o) => o.menuId));
    const menuIds = pois.map((p) => p.menuId).filter(Boolean) as string[];
    expect(menuIds.length).toBeGreaterThan(0);
    for (const id of menuIds) {
      expect(outletIds.has(id)).toBe(true);
    }
  });

  it("ships no invented menu data", () => {
    expect(bundledMenus.menus.length).toBe(0);
    for (const o of bundledMenus.outlets) {
      expect(o.verified).toBe(false);
    }
  });

  it("marks estimated positions honestly", () => {
    const atm = pois.find((p) => p.id === "hostel-atm");
    expect(atm).toBeDefined();
    expect(atm!.verification).toBe("estimated");
    expect(atm!.note).toBeTruthy();
    const health = pois.find((p) => p.id === "health-center");
    expect(health).toBeDefined();
    expect(health!.verification).toBe("estimated");
  });

  it("names key academic facilities", () => {
    const names = buildings.map((b) => b.name);
    expect(names).toContain("Academic Block 2 (AB2)");
    expect(names).toContain("Lab Complex");
    expect(names).toContain("Multi-purpose Hall");
    expect(names).toContain("Open Air Auditorium");
    expect(names).toContain("Architecture Building");
  });
});
