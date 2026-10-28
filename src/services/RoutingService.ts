// RoutingService — pedestrian routing over the mapped campus road/path graph.
//
// The graph is built once from walkable OSM highways (footways, paths, campus
// roads, service roads and the highway frontage). Distances come from real
// route geometry; walking time uses a documented 1.4 m/s assumption (see
// campus.json -> walkingSpeedMps). Destinations are snapped to the nearest
// graph node (<= 90 m) — beyond that, places are treated as unreachable and
// the caller shows a graceful message. Estimated/indoor shortcuts are never
// invented: routes never cross buildings or water.

import { campusMeta, paths, projector } from "./CampusDataService";
import { distMeters } from "./projection";
import type { RouteResult, RouteStep } from "@/types/campus";

interface GraphNode {
  key: string;
  lat: number;
  lon: number;
  x: number;
  z: number;
  edges: { to: GraphNode; distM: number }[];
}

const graph = new Map<string, GraphNode>();
const nodeList: GraphNode[] = [];

function nodeFor(lat: number, lon: number): GraphNode {
  // Quantize to ~0.1 m so shared endpoints merge into one node.
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  let n = graph.get(key);
  if (!n) {
    const [x, z] = projector.project(lat, lon);
    n = { key, lat, lon, x, z, edges: [] };
    graph.set(key, n);
    nodeList.push(n);
  }
  return n;
}

// --- Build the walkable graph once ------------------------------------------
(function buildGraph() {
  const cosLat = Math.cos((campusMeta.center.lat * Math.PI) / 180);
  for (const p of paths) {
    if (!p.walkable) continue;
    const coords = p.coordinates;
    for (let i = 0; i + 1 < coords.length; i++) {
      const a = nodeFor(coords[i][0], coords[i][1]);
      const b = nodeFor(coords[i + 1][0], coords[i + 1][1]);
      if (a === b) continue;
      const d = distMeters(a.lat, a.lon, b.lat, b.lon, cosLat);
      if (d <= 0) continue;
      a.edges.push({ to: b, distM: d });
      b.edges.push({ to: a, distM: d });
    }
  }
})();

// --- Snap helpers -------------------------------------------------------------

export function nearestNode(lat: number, lon: number, maxDistM = 90): GraphNode | null {
  const cosLat = Math.cos((campusMeta.center.lat * Math.PI) / 180);
  let best: GraphNode | null = null;
  let bestD = Infinity;
  for (const n of nodeList) {
    const d = distMeters(lat, lon, n.lat, n.lon, cosLat);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return bestD <= maxDistM ? best : null;
}

// --- Compass helpers -------------------------------------------------------------

function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = lat2 - lat1;
  const dLon = (lon2 - lon1) * Math.cos((lat1 * Math.PI) / 180);
  // 0 = north, 90 = east
  return (Math.atan2(dLon, dLat) * 180) / Math.PI;
}

function compass(b: number): string {
  const dirs = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
  const idx = Math.round(((b + 360) % 360) / 45) % 8;
  return dirs[idx];
}

function turnLabel(delta: number): "left" | "right" | "straight" {
  const d = ((delta + 540) % 360) - 180; // normalize to [-180, 180]
  if (Math.abs(d) < 30) return "straight";
  return d > 0 ? "right" : "left";
}

// --- Dijkstra ---------------------------------------------------------------------

function dijkstra(start: GraphNode, goal: GraphNode): GraphNode[] | null {
  const dist = new Map<string, number>();
  const prev = new Map<string, GraphNode>();
  const visited = new Set<string>();
  dist.set(start.key, 0);
  // Small graph (hundreds of nodes): array-scan Dijkstra is plenty fast.
  for (;;) {
    let current: GraphNode | null = null;
    let currentDist = Infinity;
    for (const n of nodeList) {
      if (visited.has(n.key)) continue;
      const d = dist.get(n.key);
      if (d !== undefined && d < currentDist) {
        currentDist = d;
        current = n;
      }
    }
    if (!current) return null;
    if (current === goal) break;
    visited.add(current.key);
    for (const e of current.edges) {
      if (visited.has(e.to.key)) continue;
      const nd = currentDist + e.distM;
      if (nd < (dist.get(e.to.key) ?? Infinity)) {
        dist.set(e.to.key, nd);
        prev.set(e.to.key, current);
      }
    }
  }
  const path: GraphNode[] = [];
  let cur: GraphNode | undefined = goal;
  while (cur) {
    path.unshift(cur);
    if (cur === start) break;
    cur = prev.get(cur.key);
  }
  return path[0] === start ? path : null;
}

// --- Public API ----------------------------------------------------------------------

export interface RouteInput {
  lat: number;
  lon: number;
}

/** Build simple turn-by-turn steps from route geometry (approximate — the
 *  graph carries few street names). */
function buildSteps(path: GraphNode[]): RouteStep[] {
  const steps: RouteStep[] = [];
  if (path.length < 2) return steps;
  let prevBearing = bearing(path[0].lat, path[0].lon, path[1].lat, path[1].lon);
  steps.push({ instruction: `Head ${compass(prevBearing)}`, distanceM: 0 });
  let acc = 0;
  let lastTurnIdx = 0;
  for (let i = 0; i + 1 < path.length; i++) {
    const segDist = distMeters(path[i].lat, path[i].lon, path[i + 1].lat, path[i + 1].lon, Math.cos((campusMeta.center.lat * Math.PI) / 180));
    acc += segDist;
    if (i + 2 < path.length) {
      const nextBearing = bearing(path[i].lat, path[i].lon, path[i + 1].lat, path[i + 1].lon);
      const turn = turnLabel(nextBearing - prevBearing);
      prevBearing = nextBearing;
      if (turn !== "straight" && acc - (distMeters(path[lastTurnIdx].lat, path[lastTurnIdx].lon, path[lastTurnIdx + 1]?.lat ?? path[lastTurnIdx].lat, path[lastTurnIdx + 1]?.lon ?? path[lastTurnIdx].lon, Math.cos((campusMeta.center.lat * Math.PI) / 180)) || 0) > 25) {
        steps[steps.length - 1].distanceM = +acc.toFixed(0);
        acc = 0;
        lastTurnIdx = i + 1;
        steps.push({ instruction: turn === "left" ? "Turn left" : "Turn right", distanceM: 0 });
      }
    }
  }
  steps[steps.length - 1].distanceM = +acc.toFixed(0);
  steps.push({ instruction: "Arrive at destination", distanceM: 0 });
  return steps;
}

export function routeBetween(origin: RouteInput, dest: RouteInput): RouteResult | null {
  const startNode = nearestNode(origin.lat, origin.lon);
  const goalNode = nearestNode(dest.lat, dest.lon);
  if (!startNode || !goalNode) return null;
  const nodePath = dijkstra(startNode, goalNode);
  if (!nodePath || nodePath.length < 2) return null;

  // Prepend/append the exact origin/destination points so the drawn route
  // starts and ends at the selected places.
  const cosLat = Math.cos((campusMeta.center.lat * Math.PI) / 180);
  const path: [number, number][] = nodePath.map((n) => [+n.lat.toFixed(6), +n.lon.toFixed(6)]);
  const totalPath = [
    [+origin.lat.toFixed(6), +origin.lon.toFixed(6)] as [number, number],
    ...path,
    [+dest.lat.toFixed(6), +dest.lon.toFixed(6)] as [number, number],
  ];
  let distanceM = 0;
  for (let i = 0; i + 1 < totalPath.length; i++) {
    distanceM += distMeters(totalPath[i][0], totalPath[i][1], totalPath[i + 1][0], totalPath[i + 1][1], cosLat);
  }
  distanceM += distMeters(
    origin.lat, origin.lon, nodePath[0].lat, nodePath[0].lon, cosLat
  );
  const walkingSpeed = campusMeta.walkingSpeedMps;
  return {
    path: totalPath,
    distanceM: +distanceM.toFixed(0),
    durationS: Math.round(distanceM / walkingSpeed),
    steps: buildSteps(nodePath),
  };
}

export function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

export function formatDuration(seconds: number): string {
  const min = Math.max(1, Math.round(seconds / 60));
  return `${min} min walk`;
}
