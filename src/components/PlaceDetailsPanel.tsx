// Selected-place details panel: name, category, verification, floors,
// nearby facilities, route info, actions. Bottom sheet on mobile,
// floating panel on desktop.

import { useState } from "react";
import { useMapStore } from "@/state/store";
import { searchableById, placeBuilding, poisOfBuilding } from "@/services/CampusDataService";
import { categoryMeta } from "@/data/categories";
import { formatDistance, formatDuration } from "@/services/RoutingService";
import { useFocusPlace } from "./SearchBar";
import NearbyFacilities from "./NearbyFacilities";
import MessMenuPanel from "./MessMenuPanel";
import type { Building, Place, Verification } from "@/types/campus";

function VerificationBadge({ v }: { v: Verification }) {
  const styles =
    v === "official"
      ? "border-[#3d613d] bg-[#15241a] text-[#aad8aa]"
      : v === "community"
        ? "border-[#2f5680] bg-[#131f2e] text-[#a8c9f5]"
        : "border-[#6e5a33] bg-[#241f15] text-[#e8d5a0]";
  const label =
    v === "official" ? "Verified" : v === "community" ? "Community data" : "Estimated location";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${styles}`} title={label}>
      {label}
    </span>
  );
}

export default function PlaceDetailsPanel() {
  const selectedId = useMapStore((s) => s.selectedId);
  const detailsOpen = useMapStore((s) => s.detailsOpen);
  const setDetailsOpen = useMapStore((s) => s.setDetailsOpen);
  const select = useMapStore((s) => s.select);
  const favorites = useMapStore((s) => s.favorites);
  const toggleFavorite = useMapStore((s) => s.toggleFavorite);
  const setDest = useMapStore((s) => s.setDest);
  const setRoutePlannerOpen = useMapStore((s) => s.setRoutePlannerOpen);
  const route = useMapStore((s) => s.route);
  const destId = useMapStore((s) => s.destId);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const focusPlace = useFocusPlace();

  if (!selectedId) return null;
  const sp = searchableById(selectedId);
  if (!sp) return null;

  const isBuilding = sp.kind === "building";
  const b = isBuilding ? (sp.place as Building) : null;
  const p = !isBuilding ? (sp.place as Place) : null;
  const meta = categoryMeta(sp.category);
  const insideBuilding = p ? placeBuilding(p) : null;
  const insidePois = b ? poisOfBuilding(b.id).filter((x) => x.category !== "other") : [];
  const note = p?.note ?? b?.note ?? null;
  const verification = p ? p.verification : "community";
  const updatedAt = p?.updatedAt ?? b?.updatedAt ?? null;
  const isRouteDest = route != null && destId === selectedId;

  const levels = b ? b.levels ?? b.estimatedLevels : null;
  const heightEstimated = b ? b.heightSource === "estimated" : false;

  return (
    <aside
      className={`fixed z-40 transition-transform duration-200 ${
        detailsOpen ? "translate-y-0" : "max-md:translate-y-[calc(100%-2.75rem)] md:hidden"
      } max-md:inset-x-0 max-md:bottom-0 max-md:rounded-t-2xl max-md:border-t md:right-4 md:top-20 md:w-96 md:rounded-xl`}
      role="complementary"
      aria-label="Place details"
    >
      <div className="glass slim-scroll max-h-[68vh] overflow-y-auto rounded-t-2xl md:max-h-[calc(100vh-6rem)] md:rounded-xl">
        {/* Drag/close handle */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-2 border-b border-ink-700/50 bg-ink-900/90 px-4 pb-2 pt-2.5 backdrop-blur">
          <button
            onClick={() => setDetailsOpen(false)}
            className="mx-auto -mt-1 mb-1 h-1 w-10 rounded-full bg-ink-600 md:hidden"
            aria-label="Collapse details panel"
          />
          <div className="min-w-0 flex-1 md:mt-1">
            <h2 className="truncate text-base font-semibold text-ink-100">{sp.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${meta.chipClass}`}>
                {meta.icon} {meta.label}
              </span>
              <VerificationBadge v={verification as Verification} />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => toggleFavorite(sp.id)}
              aria-label={favorites.includes(sp.id) ? "Unstar this place" : "Star this place"}
              title={favorites.includes(sp.id) ? "Unstar" : "Star"}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-lg hover:bg-ink-700"
            >
              {favorites.includes(sp.id) ? "⭐" : "☆"}
            </button>
            <button
              onClick={() => select(null)}
              aria-label="Close details"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-700 hover:text-ink-200"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="space-y-3.5 px-4 py-3.5">
          {/* Location summary */}
          <div className="text-xs text-ink-400">
            {isBuilding && b && (
              <span>
                {levels != null && (
                  <>
                    ≈ <span className="font-medium text-ink-200">{levels} {levels === 1 ? "floor" : "floors"}</span>
                    {heightEstimated && <span className="text-warn/80"> (estimated)</span>}
                    {" · "}
                  </>
                )}
                <span className="font-medium text-ink-200">{b.heightM} m</span> tall
              </span>
            )}
            {p && (
              <span>
                {insideBuilding ? (
                  <>Inside <button className="font-medium text-accent hover:underline" onClick={() => focusPlace(insideBuilding.id)}>{insideBuilding.name}</button></>
                ) : (
                  <>Campus facility{p.lat != null && ` (${p.lat.toFixed(5)}, ${p.lon?.toFixed(5)})`}</>
                )}
              </span>
            )}
          </div>

          {/* Route summary */}
          {isRouteDest && route && (
            <div className="rounded-lg border border-[#6e5433]/50 bg-[#241d15]/70 px-3 py-2">
              <div className="text-xs font-semibold text-route">
                🚶 {formatDistance(route.distanceM)} · {formatDuration(route.durationS)}
              </div>
              <div className="mt-0.5 text-[10px] text-ink-500">from your selected starting point</div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setDest(sp.id);
                setRoutePlannerOpen(true);
              }}
              className="flex-1 rounded-lg border border-accent/50 bg-accent-dim px-3 py-2 text-xs font-semibold text-[#a8c9f5] hover:bg-accent/25"
            >
              🧭 Directions
            </button>
            {p?.menuId && (
              <a
                href="#menu"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById("mess-menu-section")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                }}
                className="flex-1 rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-center text-xs font-semibold text-ink-200 hover:border-ink-500"
              >
                🍽 Menu
              </a>
            )}
          </div>

          {/* Note */}
          {note && (
            <div className="rounded-lg border border-[#6e5a33]/40 bg-[#241f15]/60 px-3 py-2 text-[11px] leading-relaxed text-[#d9cfa8]">
              ℹ️ {note}
            </div>
          )}

          {/* Floors */}
          {isBuilding && b && (
            <div>
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                Floors
              </h3>
              {b.floors && b.floors.length > 0 ? (
                <ul className="space-y-1">
                  {b.floors.map((f) => (
                    <li key={f.level} className="rounded-lg border border-ink-700/60 bg-ink-850/60 px-2.5 py-1.5 text-xs text-ink-300">
                      <span className="font-medium text-ink-200">
                        {f.level === 0 ? "Ground floor" : `Level ${f.level}`}
                      </span>
                      {f.note && <span className="text-ink-500"> — {f.note}</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-ink-500">
                  {b.floorsNote ?? "Floor-wise room directory not available. Room-level navigation is not yet possible on campus."}
                </p>
              )}
            </div>
          )}

          {/* Places inside this building */}
          {isBuilding && insidePois.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                Here
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {insidePois.map((ip) => (
                  <button
                    key={ip.id}
                    onClick={() => focusPlace(ip.id)}
                    className="rounded-lg border border-ink-600 bg-ink-800 px-2.5 py-1 text-[11px] text-ink-200 hover:border-accent hover:text-white"
                  >
                    {categoryMeta(ip.category).icon} {ip.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Mess menu */}
          {p?.menuId && (
            <div id="mess-menu-section">
              <MessMenuPanel menuId={p.menuId} placeName={p.name} />
            </div>
          )}

          {/* Nearby */}
          <NearbyFacilities />

          {/* Sources */}
          <div>
            <button
              onClick={() => setSourcesOpen(!sourcesOpen)}
              className="flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-ink-500 hover:text-ink-300"
              aria-expanded={sourcesOpen}
            >
              Data sources & status
              <span aria-hidden>{sourcesOpen ? "▾" : "▸"}</span>
            </button>
            {sourcesOpen && (
              <ul className="mt-1.5 space-y-1">
                {(p ? p.sources : b?.sources ?? []).map((s, i) => (
                  <li key={i} className="text-[11px] text-ink-500">
                    {s.url ? (
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-accent/80 hover:underline">
                        {s.label}
                      </a>
                    ) : (
                      s.label
                    )}
                    {" · "}
                    <span className={s.verification === "official" ? "text-success/80" : s.verification === "community" ? "text-accent/70" : "text-warn/80"}>
                      {s.verification}
                    </span>
                  </li>
                ))}
                {updatedAt && (
                  <li className="text-[10px] text-ink-600">Last updated {updatedAt}</li>
                )}
              </ul>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
