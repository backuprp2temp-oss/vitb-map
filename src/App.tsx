// App — VITmap Bhopal: full-screen 3D campus + floating UI.
// Owns route recomputation and global keyboard shortcuts.

import { useEffect, useState } from "react";
import CampusMap from "./components/CampusMap";
import SearchBar from "./components/SearchBar";
import CategoryFilters from "./components/CategoryFilters";
import FavoritesPanel from "./components/FavoritesPanel";
import PlaceDetailsPanel from "./components/PlaceDetailsPanel";
import RoutePlanner from "./components/RoutePlanner";
import MapControls from "./components/MapControls";
import FeedbackDialog from "./components/FeedbackDialog";
import MenuAdminDialog from "./components/MenuAdminDialog";
import LoadingScreen from "./components/LoadingScreen";
import { useMapStore } from "@/state/store";
import { campusMeta, routingPoint, searchableById } from "@/services/CampusDataService";
import { routeBetween } from "@/services/RoutingService";

export default function App() {
  const [ready, setReady] = useState(false);
  const [fading, setFading] = useState(false);

  const originId = useMapStore((s) => s.originId);
  const originPoint = useMapStore((s) => s.originPoint);
  const destId = useMapStore((s) => s.destId);
  const destPoint = useMapStore((s) => s.destPoint);
  const userLocation = useMapStore((s) => s.userLocation);
  const userLocationStatus = useMapStore((s) => s.userLocationStatus);
  const setRoute = useMapStore((s) => s.setRoute);
  const setRoutePlannerOpen = useMapStore((s) => s.setRoutePlannerOpen);
  const setDetailsOpen = useMapStore((s) => s.setDetailsOpen);
  const setFeedbackOpen = useMapStore((s) => s.setFeedbackOpen);
  const setMenuAdminOpen = useMapStore((s) => s.setMenuAdminOpen);
  const pickMode = useMapStore((s) => s.pickMode);

  // Route recomputation whenever origin/destination/user location changes.
  useEffect(() => {
    if (!destId && !destPoint) {
      setRoute(null);
      return;
    }
    let origin: { lat: number; lon: number } | null = null;
    if (originId) origin = routingPoint(searchableById(originId));
    else if (originPoint) origin = originPoint;
    else if (userLocationStatus === "granted" && userLocation) origin = userLocation;
    else origin = { lat: campusMeta.center.lat, lon: campusMeta.center.lon };

    const dest = destId ? routingPoint(searchableById(destId)) : destPoint;
    if (!origin || !dest) {
      setRoute(null, "Could not resolve the selected locations.");
      return;
    }
    const result = routeBetween(origin, dest);
    if (result) {
      setRoute(result);
    } else {
      setRoute(null, "No walking route found — these locations may not be connected by mapped paths.");
    }
  }, [originId, originPoint, destId, destPoint, userLocation, userLocationStatus, setRoute]);

  // Global keyboard shortcuts: Escape closes topmost panel.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      const s = useMapStore.getState();
      if (s.feedbackOpen) setFeedbackOpen(false);
      else if (s.menuAdminOpen) setMenuAdminOpen(false);
      else if (s.routePlannerOpen) setRoutePlannerOpen(false);
      else if (s.detailsOpen) setDetailsOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setFeedbackOpen, setMenuAdminOpen, setRoutePlannerOpen, setDetailsOpen]);

  // Loading screen fade-out once the canvas is ready.
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => setFading(true), 250);
    const t2 = setTimeout(() => setReady(false), 800);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [ready]);

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-ink-950 font-sans text-ink-200">
      <CampusMap onReady={() => setReady(true)} />

      {/* Pick-mode banner */}
      {pickMode && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-40 -translate-x-1/2 rounded-full border border-accent/60 bg-accent-dim px-4 py-1.5 text-xs font-medium text-white shadow-lg">
          Tap the map to set {pickMode === "origin" ? "a starting point" : "a destination"} · Esc to cancel
        </div>
      )}

      {/* Top-left stack: search + filters + favorites */}
      <div className="absolute left-3 right-3 top-3 z-30 flex flex-col gap-2 md:left-4 md:top-4 md:w-[420px] md:right-auto">
        <SearchBar />
        <CategoryFilters />
        <FavoritesPanel />
      </div>

      {/* Right panel + bottom sheet */}
      <PlaceDetailsPanel />
      <RoutePlanner />

      {/* Map controls */}
      <div className="absolute bottom-28 right-3 z-30 md:bottom-6 md:right-4">
        <MapControls />
      </div>

      {/* Attribution */}
      <div className="pointer-events-none absolute bottom-1 left-3 z-20 max-w-[60%] md:bottom-1.5 md:left-4">
        <p className="truncate text-[9px] leading-relaxed text-ink-600 md:text-[10px]">
          Map data ©{" "}
          <a
            className="pointer-events-auto text-ink-500 hover:underline"
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
          >
            OpenStreetMap contributors
          </a>{" "}
          · building heights estimated unless labelled · routes assume {campusMeta.walkingSpeedMps} m/s walking
        </p>
      </div>

      <FeedbackDialog />
      <MenuAdminDialog />
      {(ready || !fading) && <LoadingScreen fading={fading} />}
    </div>
  );
}
