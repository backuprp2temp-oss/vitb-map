// RoutePlanner — origin/destination picker + walking route summary with
// turn-by-turn instructions. Route computation itself runs in App so the
// route overlay survives closing this panel.

import { searchableById, searchablePlaces, campusMeta, projector } from "@/services/CampusDataService";
import { formatDistance, formatDuration } from "@/services/RoutingService";
import { useMapStore } from "@/state/store";
import { categoryMeta } from "@/data/categories";
import { useFocusPlace } from "./SearchBar";

const SORTED_PLACES = [...searchablePlaces].sort((a, b) => a.name.localeCompare(b.name));

function OriginSelect() {
  const originId = useMapStore((s) => s.originId);
  const originLabel = useMapStore((s) => s.originLabel);
  const setOrigin = useMapStore((s) => s.setOrigin);
  const setPickMode = useMapStore((s) => s.setPickMode);
  const pickMode = useMapStore((s) => s.pickMode);

  return (
    <div className="flex gap-1.5">
      <select
        value={originId ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) setOrigin(null, null);
          else {
            const sp = searchableById(v);
            setOrigin(v, sp?.name ?? null);
          }
        }}
        className="dark-select w-full rounded-lg border border-ink-600 px-2.5 py-2 text-xs outline-none"
        aria-label="Starting point"
      >
        <option value="">{originLabel ? `📍 ${originLabel}` : "Choose start… (default: main campus)"}</option>
        {SORTED_PLACES.map((sp) => (
          <option key={sp.id} value={sp.id}>
            {categoryMeta(sp.category).icon} {sp.name}
          </option>
        ))}
      </select>
      <button
        onClick={() => setPickMode(pickMode === "origin" ? null : "origin")}
        title="Pick a starting point on the map"
        aria-label="Pick starting point on map"
        className={`flex h-[34px] flex-shrink-0 items-center rounded-lg border px-2 text-xs ${
          pickMode === "origin"
            ? "border-accent bg-accent-dim text-white"
            : "border-ink-600 bg-ink-800 text-ink-300 hover:text-ink-100"
        }`}
      >
        🖐
      </button>
    </div>
  );
}

function DestSelect() {
  const destId = useMapStore((s) => s.destId);
  const destLabel = useMapStore((s) => s.destLabel);
  const setDest = useMapStore((s) => s.setDest);
  const setPickMode = useMapStore((s) => s.setPickMode);
  const pickMode = useMapStore((s) => s.pickMode);

  return (
    <div className="flex gap-1.5">
      <select
        value={destId ?? ""}
        onChange={(e) => setDest(e.target.value || null)}
        className="dark-select w-full rounded-lg border border-ink-600 px-2.5 py-2 text-xs outline-none"
        aria-label="Destination"
      >
        <option value="">{destLabel ? `📍 ${destLabel}` : "Choose destination…"}</option>
        {SORTED_PLACES.map((sp) => (
          <option key={sp.id} value={sp.id}>
            {categoryMeta(sp.category).icon} {sp.name}
          </option>
        ))}
      </select>
      <button
        onClick={() => setPickMode(pickMode === "destination" ? null : "destination")}
        title="Pick a destination on the map"
        aria-label="Pick destination on map"
        className={`flex h-[34px] flex-shrink-0 items-center rounded-lg border px-2 text-xs ${
          pickMode === "destination"
            ? "border-accent bg-accent-dim text-white"
            : "border-ink-600 bg-ink-800 text-ink-300 hover:text-ink-100"
        }`}
      >
        🖐
      </button>
    </div>
  );
}

export default function RoutePlanner() {
  const routePlannerOpen = useMapStore((s) => s.routePlannerOpen);
  const setRoutePlannerOpen = useMapStore((s) => s.setRoutePlannerOpen);
  const route = useMapStore((s) => s.route);
  const routeError = useMapStore((s) => s.routeError);
  const destId = useMapStore((s) => s.destId);
  const destPoint = useMapStore((s) => s.destPoint);
  const clearRoute = useMapStore((s) => s.clearRoute);
  const setOrigin = useMapStore((s) => s.setOrigin);
  const setOriginPoint = useMapStore((s) => s.setOriginPoint);
  const setDest = useMapStore((s) => s.setDest);
  const setDestPoint = useMapStore((s) => s.setDestPoint);
  const focusPlace = useFocusPlace();

  if (!routePlannerOpen) return null;

  const swap = () => {
    const state = useMapStore.getState();
    const oId = state.originId;
    const oPt = state.originPoint;
    const oLabel = state.originLabel;
    const dId = state.destId;
    const dPt = state.destPoint;
    const dLabel = state.destLabel;
    if (dId) setOrigin(dId, dLabel);
    else if (dPt) setOriginPoint(dPt, dLabel ?? "Map point");
    else setOrigin(null, null);
    if (oId) setDest(oId);
    else if (oPt) setDestPoint(oPt, oLabel ?? "Map point");
    else setDest(null);
  };

  const hasDest = !!(destId || destPoint);

  return (
    <div
      className="glass slim-scroll fixed z-40 max-h-[70vh] w-full overflow-y-auto rounded-xl shadow-xl shadow-black/50 max-md:inset-x-0 max-md:bottom-0 max-md:rounded-t-2xl md:left-4 md:top-20 md:w-96"
      role="complementary"
      aria-label="Route planner"
    >
      <div className="flex items-center justify-between border-b border-ink-700/50 px-4 pb-2 pt-3">
        <h2 className="text-sm font-semibold text-ink-100">🧭 Directions</h2>
        <button
          onClick={() => setRoutePlannerOpen(false)}
          aria-label="Close route planner"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-700 hover:text-ink-200"
        >
          ✕
        </button>
      </div>

      <div className="space-y-2.5 px-4 py-3">
        <OriginSelect />
        <div className="flex justify-center">
          <button
            onClick={swap}
            title="Swap start and destination"
            aria-label="Swap start and destination"
            className="rounded-lg border border-ink-600 bg-ink-800 px-2.5 py-1 text-xs text-ink-300 hover:text-ink-100"
          >
            ⇅ swap
          </button>
        </div>
        <DestSelect />

        {route && (
          <div className="rounded-xl border border-[#6e5433]/50 bg-[#241d15]/70 p-3">
            <div className="mb-1.5 flex items-baseline gap-2">
              <span className="text-base font-bold text-route">{formatDistance(route.distanceM)}</span>
              <span className="text-xs text-ink-300">{formatDuration(route.durationS)}</span>
            </div>
            <p className="mb-2 text-[10px] text-ink-500">
              Walking route along mapped paths · assumed speed {campusMeta.walkingSpeedMps} m/s
            </p>
            <ol className="space-y-1">
              {route.steps.map((step, i) => (
                <li key={i} className="flex items-baseline gap-2 text-xs text-ink-300">
                  <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-ink-700 text-[9px] text-ink-300">
                    {i + 1}
                  </span>
                  <span>
                    {step.instruction}
                    {step.distanceM > 0 && (
                      <span className="ml-1 text-[10px] text-ink-500">({formatDistance(step.distanceM)})</span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => {
                  const last = route.path[route.path.length - 1];
                  if (destId) focusPlace(destId);
                  else {
                    // focus map point
                    useMapStore.getState().focusOn(
                      projector.project(last[0], last[1])[0],
                      projector.project(last[0], last[1])[1],
                      260
                    );
                  }
                }}
                className="flex-1 rounded-md border border-ink-600 bg-ink-800 px-2 py-1.5 text-[11px] text-ink-200 hover:border-ink-500"
              >
                🔎 Show destination
              </button>
              <button
                onClick={clearRoute}
                className="rounded-md border border-ink-600 bg-ink-800 px-2 py-1.5 text-[11px] text-ink-400 hover:text-[#f0aeae]"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {hasDest && !route && routeError && (
          <div className="rounded-xl border border-[#6e3d40]/50 bg-[#261617]/70 px-3 py-2.5 text-xs text-[#f0aeae]">
            ⚠️ {routeError}
          </div>
        )}

        {hasDest && !route && !routeError && (
          <p className="px-1 text-xs text-ink-500">Calculating route…</p>
        )}

        {!hasDest && (
          <p className="px-1 text-xs text-ink-500">
            Choose a destination to get walking directions. Pick 🖐 to tap a point
            on the map, or search in the bar above.
          </p>
        )}
      </div>
    </div>
  );
}
