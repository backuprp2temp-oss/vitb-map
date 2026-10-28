// RoutingService tests: graph routing over mapped paths, distance/time from
// geometry, documented walking speed, unreachable handling.

import { describe, it, expect } from "vitest";
import { routeBetween, nearestNode, formatDistance, formatDuration } from "@/services/RoutingService";
import { searchableById, routingPoint, campusMeta } from "@/services/CampusDataService";

const ab1 = searchableById("osm-rel-16248225");
const hostelA = searchableById("osm-way-1367916185");
const mess = searchableById("osm-node-11515616398");
const mayuriCafe = searchableById("osm-node-12685733586");

describe("RoutingService", () => {
  it("routes from Academic Block 1 to Boys Hostel Block A", () => {
    expect(ab1).not.toBeNull();
    expect(hostelA).not.toBeNull();
    const o = routingPoint(ab1!);
    const d = routingPoint(hostelA!);
    expect(o).not.toBeNull();
    expect(d).not.toBeNull();

    const route = routeBetween(o!, d!);
    expect(route).not.toBeNull();
    expect(route!.path.length).toBeGreaterThanOrEqual(2);
    expect(route!.distanceM).toBeGreaterThan(50);
    expect(route!.distanceM).toBeLessThan(2000);
  });

  it("computes duration from distance at the documented walking speed", () => {
    const o = routingPoint(ab1!);
    const d = routingPoint(hostelA!);
    const route = routeBetween(o!, d!)!;
    expect(route.durationS).toBe(Math.round(route.distanceM / campusMeta.walkingSpeedMps));
  });

  it("routes in both directions", () => {
    const o = routingPoint(ab1!);
    const d = routingPoint(mayuriCafe!);
    const forward = routeBetween(o!, d!);
    const backward = routeBetween(d!, o!);
    expect(forward).not.toBeNull();
    expect(backward).not.toBeNull();
  });

  it("routes from the mess to the cafe", () => {
    const o = routingPoint(mess!);
    const d = routingPoint(mayuriCafe!);
    const route = routeBetween(o!, d!);
    expect(route).not.toBeNull();
    expect(route!.distanceM).toBeGreaterThan(10);
    expect(route!.distanceM).toBeLessThan(1500);
  });

  it("generates turn-by-turn steps ending with arrival", () => {
    const o = routingPoint(ab1!);
    const d = routingPoint(mess!);
    const route = routeBetween(o!, d!)!;
    expect(route.steps.length).toBeGreaterThanOrEqual(2);
    expect(route.steps[0].instruction).toMatch(/^Head /);
    expect(route.steps[route.steps.length - 1].instruction).toBe("Arrive at destination");
    for (const step of route.steps) {
      expect(step.distanceM).toBeGreaterThanOrEqual(0);
    }
  });

  it("snaps destinations to the walkable graph", () => {
    // The boys hostel mess sits inside its building, off the path network.
    const d = routingPoint(mess!);
    expect(nearestNode(d!.lat, d!.lon)).not.toBeNull();
  });

  it("treats far-away points as unreachable", () => {
    // Bhopal city centre — far beyond the 90 m snap radius.
    const route = routeBetween({ lat: 23.2599, lon: 77.4126 }, routingPoint(ab1!)!);
    expect(route).toBeNull();
    expect(nearestNode(23.2599, 77.4126)).toBeNull();
  });

  it("formats distances and durations", () => {
    expect(formatDistance(500)).toBe("500 m");
    expect(formatDistance(1250)).toBe("1.3 km");
    expect(formatDuration(84)).toBe("1 min walk");
    expect(formatDuration(600)).toBe("10 min walk");
  });
});
