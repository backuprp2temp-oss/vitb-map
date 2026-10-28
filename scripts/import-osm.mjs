// scripts/import-osm.mjs
// -----------------------------------------------------------------------------
// VITmap Bhopal — OSM ingestion pipeline.
//
// 1. Fetches geographic data for the VIT Bhopal campus area from the Overpass
//    API (OpenStreetMap).
// 2. Normalizes features into VITmap's internal schema.
// 3. Merges manually curated information from data/manual-overrides.json so
//    curated data survives upstream changes.
// 4. Detects duplicate locations and records sources/timestamps.
//
// Usage: npm run import:osm
// -----------------------------------------------------------------------------

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// VIT Bhopal University, Kothri Kalan, Sehore district, Madhya Pradesh.
// Campus centre from the OSM university node 9528736164.
const CAMPUS_CENTER = { lat: 23.075509, lon: 76.849778 };

// Tight box around the built campus (academic buildings, hostels, sports,
// ponds, internal roads).
const CAMPUS_BBOX = { south: 23.0695, west: 76.8475, north: 23.08, east: 76.864 };

// Larger box for road/path/area context (highway frontage, approach roads,
// the Lasudiyakhaas Talab pond north-east of campus).
const CONTEXT_BBOX = { south: 23.058, west: 76.83, north: 23.09, east: 76.875 };

// Documented height assumption: one building level ~= 3.2 m.
const METERS_PER_LEVEL = 3.2;

const WALKABLE_HIGHWAY = new Set([
  "footway", "path", "steps", "pedestrian", "living_street",
  "residential", "unclassified", "service", "track",
  "tertiary", "tertiary_link", "secondary", "secondary_link",
  "trunk", "trunk_link",
]);

// Default estimated level counts, used only when OSM has no building:levels.
// These are visual estimates and are flagged heightSource: "estimated".
const DEFAULT_LEVELS = {
  hostel: 4, academic: 3, food: 1, event: 2, residence: 2,
  service: 1, study: 2, medical: 1, campus: 1, other: 2,
};

// ---------------------------------------------------------------------------
// Minimal .env loader (no dependency)
// ---------------------------------------------------------------------------

function loadEnv() {
  const envFile = path.join(ROOT, ".env");
  if (!fs.existsSync(envFile)) return;
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
  }
}

// ---------------------------------------------------------------------------
// Overpass fetch (with mirror fallback)
// ---------------------------------------------------------------------------

async function fetchOverpass(query) {
  const mirrors = [
    process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];
  let lastErr;
  for (const url of mirrors) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            // Overpass rejects some default user agents; send a descriptive one.
            "User-Agent": "VITmap-Bhopal/1.0 (campus map project)",
            Accept: "application/json",
          },
          body: "data=" + encodeURIComponent(query),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
        return await res.json();
      } catch (err) {
        lastErr = err;
        console.warn(`  ! attempt ${attempt + 1} failed (${err.message}), retrying...`);
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }
  throw lastErr;
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function bboxOfRing(coords) {
  let south = 90, west = 180, north = -90, east = -180;
  for (const [lat, lon] of coords) {
    if (lat < south) south = lat;
    if (lat > north) north = lat;
    if (lon < west) west = lon;
    if (lon > east) east = lon;
  }
  return { south, west, north, east };
}

function ringIntersectsBbox(coords, bbox) {
  const b = bboxOfRing(coords);
  return !(b.north < bbox.south || b.south > bbox.north || b.east < bbox.west || b.west > bbox.east);
}

function pointInBbox(lat, lon, bbox) {
  return lat >= bbox.south && lat <= bbox.north && lon >= bbox.west && lon <= bbox.east;
}

function pointInRing(lat, lon, ring) {
  // Ray-casting; ring is [lat, lon][].
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

function centroidOfRing(ring) {
  let lat = 0, lon = 0;
  for (const [la, lo] of ring) { lat += la; lon += lo; }
  const n = Math.max(ring.length, 1);
  return { lat: lat / n, lon: lon / n };
}

// Approximate distance in meters between two [lat, lon] points.
function distMeters(a, b) {
  const dLat = (b[0] - a[0]) * 110574;
  const dLon = (b[1] - a[1]) * 111320 * Math.cos((CAMPUS_CENTER.lat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLon * dLon);
}

// Stitch OpenStreetMap outer ways of a (multi)polygon relation into closed
// rings by matching endpoint coordinates.
function stitchRings(outerGeoms) {
  const segments = outerGeoms
    .filter((g) => g && g.length >= 2)
    .map((g) => g.map((p) => [p.lat, p.lon]));
  if (segments.length === 0) return [];
  const rings = [];
  const used = new Set();
  for (let i = 0; i < segments.length; i++) {
    if (used.has(i)) continue;
    let ring = [...segments[i]];
    used.add(i);
    let grew = true;
    while (grew && ring.length < 2000) {
      grew = false;
      const head = ring[0];
      const tail = ring[ring.length - 1];
      for (let j = 0; j < segments.length; j++) {
        if (used.has(j)) continue;
        const seg = segments[j];
        const s0 = seg[0];
        const s1 = seg[seg.length - 1];
        if (close2(tail, s0)) { ring = ring.concat(seg.slice(1)); used.add(j); grew = true; break; }
        if (close2(tail, s1)) { ring = ring.concat(seg.slice().reverse().slice(1)); used.add(j); grew = true; break; }
        if (close2(head, s0)) { ring = seg.slice().reverse().concat(ring.slice(1)); used.add(j); grew = true; break; }
        if (close2(head, s1)) { ring = seg.slice(1).concat(ring.slice(1)); used.add(j); grew = true; break; }
      }
    }
    rings.push(ring);
  }
  return rings;
}

function close2(a, b) {
  return Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7;
}

// ---------------------------------------------------------------------------
// Classification / normalization
// ---------------------------------------------------------------------------

function buildingCategory(tags) {
  if (tags.tourism === "hostel") return "hostel";
  if (tags.amenity === "restaurant" || tags.amenity === "cafe" || tags.amenity === "food_court" || tags.amenity === "fast_food") return "food";
  if (tags.building === "house") return "residence";
  if (tags.building === "university" || tags.building === "college" || tags.building === "school") return "academic";
  if (tags.shop) return "service";
  return "other";
}

function poiCategory(tags) {
  if (tags.amenity === "food_court") return ["food", "mess"];
  if (tags.amenity === "cafe") return ["food", "cafe"];
  if (tags.amenity === "restaurant" || tags.amenity === "fast_food") return ["food", "restaurant"];
  if (tags.leisure === "fitness_centre") return ["sports", "gym"];
  if (tags.leisure === "pitch") return ["sports", tags.sport === "cricket" ? "cricket" : tags.sport === "volleyball" ? "volleyball" : tags.sport === "basketball" ? "basketball" : "pitch"];
  if (tags.leisure === "sports_centre") return ["sports", "sports-centre"];
  if (tags.shop) return ["service", "shop"];
  if (tags.amenity === "atm") return ["service", "atm"];
  if (tags.amenity === "pharmacy" || tags.healthcare) return ["medical", "clinic"];
  if (tags.amenity === "toilets") return ["service", "restroom"];
  if (tags.amenity === "parking" || tags.amenity === "parking_space") return ["service", "parking"];
  if (tags.amenity === "library") return ["study", "library"];
  if (tags.amenity === "place_of_worship") return ["facility", "place-of-worship"];
  return ["facility", "other"];
}

function autoBuildingName(tags, category) {
  if (tags.name) return tags.name;
  if (tags.tourism === "hostel") return "Hostel building";
  if (category === "food") return "Dining building";
  if (tags.shop) return "Shop building";
  return "Unnamed building";
}

async function main() {
  loadEnv();

  const south = CONTEXT_BBOX.south, west = CONTEXT_BBOX.west;
  const north = CONTEXT_BBOX.north, east = CONTEXT_BBOX.east;
  const query = `[out:json][timeout:90];
(
  nwr["building"](${south},${west},${north},${east});
  nwr["highway"](${south},${west},${north},${east});
  nwr["amenity"](${south},${west},${north},${east});
  nwr["leisure"](${south},${west},${north},${east});
  nwr["natural"](${south},${west},${north},${east});
  nwr["landuse"](${south},${west},${north},${east});
);
out geom;`;

  console.log("Fetching OSM data from Overpass API...");
  console.log(`  bbox: ${JSON.stringify(CONTEXT_BBOX)}`);
  const dataPath = path.join(ROOT, "data", "raw");
  fs.mkdirSync(dataPath, { recursive: true });

  let data;
  const cached = process.argv.includes("--cached");
  const cacheFile = path.join(dataPath, "overpass-campus.json");
  if (cached && fs.existsSync(cacheFile)) {
    console.log("  using cached raw response (--cached)");
    data = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
  } else {
    data = await fetchOverpass(query);
    fs.writeFileSync(cacheFile, JSON.stringify(data));
    console.log(`  saved raw response to data/raw/overpass-campus.json`);
  }

  const elements = data.elements || [];
  console.log(`  ${elements.length} raw elements`);

  // ---- Pass 1: collect ways with geometry & relations ----------------------
  const ways = new Map(); // id -> { id, tags, geometry: [lat,lon][] }
  const relations = [];
  const nodes = [];
  for (const el of elements) {
    if (el.type === "way" && el.geometry) {
      ways.set(el.id, { id: el.id, tags: el.tags || {}, geometry: el.geometry.map((p) => [p.lat, p.lon]) });
    } else if (el.type === "relation") {
      relations.push(el);
    } else if (el.type === "node") {
      nodes.push(el);
    }
  }

  // ---- Buildings ------------------------------------------------------------
  const buildings = [];
  const seenBuildingIds = new Set();

  function pushBuilding(ring, tags, osmType, osmId) {
    if (!ring || ring.length < 3) return;
    if (!ringIntersectsBbox(ring, CAMPUS_BBOX)) return;
    const key = `${osmType}-${osmId}`;
    if (seenBuildingIds.has(key)) return;
    seenBuildingIds.add(key);
    const category = buildingCategory(tags);
    const levels = tags["building:levels"] ? parseFloat(tags["building:levels"]) : undefined;
    const estLevels = levels ?? (DEFAULT_LEVELS[category] ?? DEFAULT_LEVELS.other);
    buildings.push({
      id: `osm-${osmType}-${osmId}`,
      osmType,
      osmId,
      name: autoBuildingName(tags, category),
      category,
      subcategory: tags.tourism === "hostel" ? "hostel" : null,
      polygon: ring,
      levels: levels ?? null,
      estimatedLevels: levels ? null : estLevels,
      heightM: +(estLevels * METERS_PER_LEVEL).toFixed(1),
      heightSource: levels ? "osm:building:levels" : "estimated",
      aliases: [],
      sources: [{
        label: `OpenStreetMap ${osmType} ${osmId}`,
        url: `https://www.openstreetmap.org/${osmType}/${osmId}`,
        verification: "community",
      }],
      note: null,
      updatedAt: new Date().toISOString().slice(0, 10),
    });
  }

  for (const w of ways.values()) {
    if (w.tags.building) pushBuilding(w.geometry, w.tags, "way", w.id);
  }
  for (const rel of relations) {
    if (!rel.tags || !rel.tags.building || rel.tags.type !== "multipolygon") continue;
    const members = (rel.members || []).filter((m) => m.type === "way" && m.role === "outer" && m.geometry);
    const rings = stitchRings(members.map((m) => m.geometry));
    // Use the largest stitched ring as the footprint.
    let best = null, bestArea = -1;
    for (const ring of rings) {
      const b = bboxOfRing(ring);
      const area = (b.north - b.south) * (b.east - b.west);
      if (area > bestArea) { bestArea = area; best = ring; }
    }
    if (best) pushBuilding(best, rel.tags, "rel", rel.id);
  }

  // ---- Entrances: nearest walkable path/road vertex to each building --------
  const walkableCoords = [];
  for (const w of ways.values()) {
    const hw = w.tags.highway;
    if (!hw || !WALKABLE_HIGHWAY.has(hw)) continue;
    if (w.tags.foot === "no") continue;
    for (const c of w.geometry) walkableCoords.push(c);
  }
  for (const b of buildings) {
    let bestD = Infinity, bestC = null;
    for (const v of b.polygon) {
      for (const c of walkableCoords) {
        const d = distMeters(v, c);
        if (d < bestD) { bestD = d; bestC = v; }
      }
    }
    if (bestC && bestD <= 60) {
      b.entrance = { lat: +bestC[0].toFixed(6), lon: +bestC[1].toFixed(6), verification: "estimated" };
    } else {
      b.entrance = null;
    }
  }

  // ---- Points of interest ----------------------------------------------------
  const pois = [];
  for (const n of nodes) {
    const tags = n.tags || {};
    if (!tags.amenity && !tags.leisure && !tags.shop && !tags.healthcare) continue;
    if (tags.amenity === "university" || tags.amenity === "college") continue; // handled as buildings/campus point
    if (!pointInBbox(n.lat, n.lon, CAMPUS_BBOX)) continue;
    const [category, subcategory] = poiCategory(tags);
    let insideBuildingId = null;
    for (const b of buildings) {
      if (pointInRing(n.lat, n.lon, b.polygon)) { insideBuildingId = b.id; break; }
    }
    pois.push({
      id: `osm-node-${n.id}`,
      osmType: "node",
      osmId: n.id,
      name: tags.name || "Unnamed facility",
      category,
      subcategory,
      lat: n.lat,
      lon: n.lon,
      insideBuildingId,
      menuId: null,
      aliases: [],
      verification: "community",
      sources: [{
        label: `OpenStreetMap node ${n.id}`,
        url: `https://www.openstreetmap.org/node/${n.id}`,
        verification: "community",
      }],
      note: null,
      updatedAt: new Date().toISOString().slice(0, 10),
    });
  }

  // ---- Roads & paths ----------------------------------------------------------
  const paths = [];
  for (const w of ways.values()) {
    const hw = w.tags.highway;
    if (!hw || !WALKABLE_HIGHWAY.has(hw)) continue;
    if (!ringIntersectsBbox(w.geometry, CONTEXT_BBOX)) continue;
    const isPath = hw === "footway" || hw === "path" || hw === "steps" || hw === "pedestrian";
    paths.push({
      id: `osm-way-${w.id}`,
      name: w.tags.name || null,
      kind: isPath ? "path" : "road",
      osmClass: hw,
      walkable: w.tags.foot !== "no",
      coordinates: w.geometry.map(([lat, lon]) => [+lat.toFixed(6), +lon.toFixed(6)]),
    });
  }

  // ---- Areas: water, green, sports grounds ------------------------------------
  const areas = [];
  function pushArea(ring, tags, osmType, osmId) {
    if (!ring || ring.length < 3) return;
    if (!ringIntersectsBbox(ring, CONTEXT_BBOX)) return;
    let kind = null, name = tags.name || null;
    if (tags.natural === "water") kind = "water";
    else if (tags.leisure === "pitch") kind = "sports";
    else if (tags.leisure === "park" || tags.leisure === "garden" || tags.landuse === "grass" || tags.landuse === "recreation_ground") kind = "green";
    else if (tags.amenity === "parking" || tags.amenity === "parking_space") { kind = "parking"; }
    if (!kind) return;
    areas.push({
      id: `osm-${osmType}-${osmId}`,
      name,
      kind,
      osmClass: tags.leisure || tags.natural || tags.landuse || tags.amenity,
      coordinates: ring.map(([lat, lon]) => [+lat.toFixed(6), +lon.toFixed(6)]),
    });
  }
  for (const w of ways.values()) {
    const t = w.tags;
    if (t.natural === "water" || t.leisure === "pitch" || t.leisure === "park" ||
        t.leisure === "garden" || t.landuse === "grass" || t.landuse === "recreation_ground" ||
        t.amenity === "parking" || t.amenity === "parking_space") {
      pushArea(w.geometry, t, "way", w.id);
    }
  }

  // ---- Apply manual overrides ---------------------------------------------------
  const overridesPath = path.join(ROOT, "data", "manual-overrides.json");
  let applied = 0;
  let manualAdds = 0;
  if (fs.existsSync(overridesPath)) {
    const overrides = JSON.parse(fs.readFileSync(overridesPath, "utf8"));
    for (const ov of overrides.override || []) {
      const m = ov.match || {};
      // Normalize the match type to our id convention ("relation" -> "rel").
      const t = m.osmType === "relation" ? "rel" : m.osmType;
      const targetId = t && m.osmId ? `osm-${t}-${m.osmId}` : null;
      const target = targetId
        ? buildings.find((b) => b.id === targetId) || pois.find((p) => p.id === targetId)
        : null;
      if (!target) {
        console.warn(`  ! override target not found: ${targetId || JSON.stringify(m)}`);
        continue;
      }
      for (const [k, v] of Object.entries(ov)) {
        if (k === "match" || k.startsWith("$")) continue;
        target[k] = v;
      }
      applied++;
    }
    for (const add of overrides.add || []) {
      const place = {
        id: add.id,
        osmType: null,
        osmId: null,
        name: add.name,
        category: add.category,
        subcategory: add.subcategory || null,
        lat: add.lat ?? null,
        lon: add.lon ?? null,
        insideBuildingId: add.buildingId || null,
        menuId: add.menuId || null,
        aliases: add.aliases || [],
        verification: add.verification || "estimated",
        sources: add.sources || [],
        note: add.note || null,
        updatedAt: new Date().toISOString().slice(0, 10),
      };
      pois.push(place);
      manualAdds++;
    }
  }

  // ---- Duplicate detection --------------------------------------------------------
  let dupWarnings = 0;
  for (let i = 0; i < buildings.length; i++) {
    for (let j = i + 1; j < buildings.length; j++) {
      const a = centroidOfRing(buildings[i].polygon);
      const b = centroidOfRing(buildings[j].polygon);
      if (buildings[i].name === buildings[j].name && distMeters([a.lat, a.lon], [b.lat, b.lon]) < 30) {
        console.warn(`  ! possible duplicate building: "${buildings[i].name}" (${buildings[i].id} / ${buildings[j].id})`);
        dupWarnings++;
      }
    }
  }
  for (let i = 0; i < pois.length; i++) {
    for (let j = i + 1; j < pois.length; j++) {
      if (!pois[i].lat || !pois[j].lat) continue;
      if (pois[i].name === pois[j].name && distMeters([pois[i].lat, pois[i].lon], [pois[j].lat, pois[j].lon]) < 20) {
        console.warn(`  ! possible duplicate POI: "${pois[i].name}" (${pois[i].id} / ${pois[j].id})`);
        dupWarnings++;
      }
    }
  }

  // ---- Write outputs -----------------------------------------------------------------
  const outDir = path.join(ROOT, "src", "data", "campus");
  fs.mkdirSync(outDir, { recursive: true });

  const campusMeta = {
    name: "VIT Bhopal University",
    shortName: "VIT Bhopal",
    center: CAMPUS_CENTER,
    campusBbox: CAMPUS_BBOX,
    attribution: [
      { label: "© OpenStreetMap contributors", url: "https://www.openstreetmap.org/copyright" },
      { label: "VIT Bhopal official site", url: "https://vitbhopal.ac.in" },
    ],
    heightAssumption: `${METERS_PER_LEVEL} m per building level (documented estimate)`,
    walkingSpeedMps: 1.4,
    importedAt: new Date().toISOString(),
    source: "OpenStreetMap via Overpass API + manual curation (data/manual-overrides.json)",
  };

  const now = new Date().toISOString().slice(0, 10);
  for (const b of buildings) b.updatedAt = now;
  for (const p of pois) p.updatedAt = now;

  fs.writeFileSync(path.join(outDir, "campus.json"), JSON.stringify(campusMeta, null, 2));
  fs.writeFileSync(path.join(outDir, "buildings.json"), JSON.stringify(buildings, null, 1));
  fs.writeFileSync(path.join(outDir, "points-of-interest.json"), JSON.stringify(pois, null, 1));
  fs.writeFileSync(path.join(outDir, "paths.json"), JSON.stringify(paths, null, 1));
  fs.writeFileSync(path.join(outDir, "areas.json"), JSON.stringify(areas, null, 1));

  console.log("\nImport complete:");
  console.log(`  buildings:            ${buildings.length}`);
  console.log(`  points of interest:   ${pois.length} (${manualAdds} manually curated)`);
  console.log(`  roads/paths:          ${paths.length}`);
  console.log(`  areas:                ${areas.length}`);
  console.log(`  overrides applied:    ${applied}`);
  console.log(`  duplicate warnings:   ${dupWarnings}`);
  console.log(`\nWrote JSON datasets to src/data/campus/`);
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
