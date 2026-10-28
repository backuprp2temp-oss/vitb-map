// NearbyFacilities — "What's nearby?" for the selected place.
// Distances use pedestrian route length where a route exists; otherwise a
// clearly-labelled straight-line distance.

import { useMemo, useState } from "react";
import { pois, placePosition, routingPoint, searchableById } from "@/services/CampusDataService";
import { routeBetween, formatDistance } from "@/services/RoutingService";
import { useMapStore } from "@/state/store";
import { categoryMeta } from "@/data/categories";
import { projector } from "@/services/CampusDataService";
import type { Place } from "@/types/campus";

const NEARBY_SUBCATEGORIES = [
  "atm", "mess", "cafe", "restaurant", "food-court",
  "medical", "clinic", "bicycle-parking", "restroom", "parcel",
  "parking", "library", "gym", "shop",
];

interface NearbyRow {
  poi: Place;
  distanceM: number;
  walking: boolean;
}

export default function NearbyFacilities() {
  const selectedId = useMapStore((s) => s.selectedId);
  const setOrigin = useMapStore((s) => s.setOrigin);
  const setOriginPoint = useMapStore((s) => s.setOriginPoint);
  const setDest = useMapStore((s) => s.setDest);
  const setRoutePlannerOpen = useMapStore((s) => s.setRoutePlannerOpen);
  const userLocation = useMapStore((s) => s.userLocation);
  const userLocationStatus = useMapStore((s) => s.userLocationStatus);
  const [filter, setFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"distance" | "name">("distance");

  const rows = useMemo(() => {
    const sp = searchableById(selectedId);
    if (!sp) return [];
    const origin = routingPoint(sp);
    if (!origin) return [];
    const cosLat = projector.center.lat;
    const cosLatRad = Math.cos((cosLat * Math.PI) / 180);
    const candidates = pois.filter(
      (p) =>
        p.id !== sp.id &&
        NEARBY_SUBCATEGORIES.includes(p.subcategory ?? "") &&
        placePosition(p) != null
    );
    const out: NearbyRow[] = [];
    for (const p of candidates) {
      const pos = placePosition(p)!;
      const r = routeBetween(origin, pos);
      if (r) {
        out.push({ poi: p, distanceM: r.distanceM, walking: true });
      } else {
        const dLat = (pos.lat - origin.lat) * 110574;
        const dLon = (pos.lon - origin.lon) * 111320 * cosLatRad;
        out.push({ poi: p, distanceM: Math.sqrt(dLat * dLat + dLon * dLon), walking: false });
      }
    }
    out.sort((a, b) => a.distanceM - b.distanceM);
    return out;
  }, [selectedId]);

  const categoriesPresent = useMemo(
    () => [...new Set(rows.map((r) => r.poi.category))],
    [rows]
  );

  const visible = useMemo(() => {
    const filtered = filter ? rows.filter((r) => r.poi.category === filter) : rows;
    const sorted = [...filtered].sort((a, b) =>
      sortBy === "distance" ? a.distanceM - b.distanceM : a.poi.name.localeCompare(b.poi.name)
    );
    return sorted.slice(0, 6);
  }, [rows, filter, sortBy]);

  const navigateTo = (destPoi: Place) => {
    const sp = searchableById(selectedId);
    if (sp && sp.kind === "building") {
      setOrigin(sp.id, sp.name);
    } else if (userLocationStatus === "granted" && userLocation) {
      setOriginPoint(userLocation, "My location");
    } else if (sp) {
      setOrigin(sp.id, sp.name);
    } else {
      return;
    }
    setDest(destPoi.id);
    setRoutePlannerOpen(true);
  };

  if (rows.length === 0) {
    return (
      <div>
        <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
          Nearby
        </h3>
        <p className="text-xs text-ink-500">
          No nearby facilities mapped yet. Use the feedback button to report one.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
          Nearby
        </h3>
        <button
          onClick={() => setSortBy(sortBy === "distance" ? "name" : "distance")}
          className="rounded-md border border-ink-700 px-1.5 py-0.5 text-[10px] text-ink-400 hover:text-ink-200"
          title="Toggle sort order"
        >
          {sortBy === "distance" ? "Sort: distance" : "Sort: name"}
        </button>
      </div>
      {categoriesPresent.length > 1 && (
        <div className="slim-scroll mb-2 flex gap-1 overflow-x-auto pb-0.5">
          <button
            onClick={() => setFilter(null)}
            className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${
              filter === null ? "border-accent text-white" : "border-ink-700 text-ink-400"
            }`}
          >
            All
          </button>
          {categoriesPresent.map((c) => (
            <button
              key={c}
              onClick={() => setFilter(filter === c ? null : c)}
              className={`flex-shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] ${
                filter === c ? categoryMeta(c).chipClass : "border-ink-700 text-ink-400"
              }`}
            >
              {categoryMeta(c).icon} {categoryMeta(c).label}
            </button>
          ))}
        </div>
      )}
      <ul className="space-y-1">
        {visible.map((r) => {
          const meta = categoryMeta(r.poi.category);
          return (
            <li
              key={r.poi.id}
              className="flex items-center gap-2 rounded-lg border border-ink-700/60 bg-ink-850/60 px-2.5 py-1.5"
            >
              <span aria-hidden className="text-sm">{meta.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-ink-200">
                  {r.poi.name}
                </span>
                <span className="block text-[10px] text-ink-500">
                  {formatDistance(r.distanceM)}{" "}
                  <span className={r.walking ? "text-ink-400" : "text-warn/80"}>
                    ({r.walking ? "walking" : "straight-line"})
                  </span>
                </span>
              </span>
              <button
                onClick={() => navigateTo(r.poi)}
                className="flex-shrink-0 rounded-md border border-accent/40 bg-accent-dim px-2 py-1 text-[10px] font-medium text-[#a8c9f5] hover:bg-accent/25"
                title={`Navigate to ${r.poi.name}`}
              >
                Go →
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
