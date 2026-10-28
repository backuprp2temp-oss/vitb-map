// Global app state (zustand). Favorites and category visibility persist to
// localStorage; everything else is session state.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { RouteResult } from "@/types/campus";
import type { CategoryId } from "@/data/categories";
import { CATEGORIES } from "@/data/categories";

export interface LatLon {
  lat: number;
  lon: number;
}

export type UserLocationStatus = "idle" | "locating" | "granted" | "denied" | "outside";

interface MapStore {
  // Selection
  selectedId: string | null;
  hoveredId: string | null;

  // Route
  originId: string | null;
  originPoint: LatLon | null;
  originLabel: string | null;
  destId: string | null;
  destPoint: LatLon | null;
  destLabel: string | null;
  route: RouteResult | null;
  routeError: string | null;
  pickMode: "origin" | "destination" | null;

  // UI
  viewMode: "3d" | "2d";
  visibleCategories: Record<string, boolean>;
  favorites: string[];
  detailsOpen: boolean;
  routePlannerOpen: boolean;
  feedbackOpen: boolean;
  menuAdminOpen: boolean;
  userLocation: (LatLon & { accuracy: number }) | null;
  userLocationStatus: UserLocationStatus;
  focusRequest: { x: number; z: number; distance?: number; topDown?: boolean; phi?: number } | null;
  zoomRequest: { direction: 1 | -1; nonce: number } | null;

  // Actions
  select: (id: string | null, opts?: { openDetails?: boolean }) => void;
  setHovered: (id: string | null) => void;
  setOrigin: (id: string | null, label: string | null) => void;
  setOriginPoint: (point: LatLon, label: string) => void;
  setDest: (id: string | null) => void;
  setDestPoint: (point: LatLon, label: string) => void;
  setRoute: (route: RouteResult | null, error?: string | null) => void;
  setPickMode: (mode: "origin" | "destination" | null) => void;
  clearRoute: () => void;
  setViewMode: (mode: "3d" | "2d") => void;
  toggleCategory: (id: CategoryId) => void;
  toggleFavorite: (id: string) => void;
  setDetailsOpen: (open: boolean) => void;
  setRoutePlannerOpen: (open: boolean) => void;
  setFeedbackOpen: (open: boolean) => void;
  setMenuAdminOpen: (open: boolean) => void;
  setUserLocation: (loc: (LatLon & { accuracy: number }) | null, status: UserLocationStatus) => void;
  focusOn: (x: number, z: number, distance?: number, topDown?: boolean, phi?: number) => void;
  clearFocus: () => void;
  zoom: (direction: 1 | -1) => void;
  setZoomRequest: (req: { direction: 1 | -1; nonce: number } | null) => void;
}

const defaultVisibleCategories = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.defaultVisible])
) as Record<string, boolean>;

export const useMapStore = create<MapStore>()(
  persist(
    (set) => ({
      selectedId: null,
      hoveredId: null,

      originId: null,
      originPoint: null,
      originLabel: null,
      destId: null,
      destPoint: null,
      destLabel: null,
      route: null,
      routeError: null,
      pickMode: null,

      viewMode: "3d",
      visibleCategories: defaultVisibleCategories,
      favorites: [],
      detailsOpen: false,
      routePlannerOpen: false,
      feedbackOpen: false,
      menuAdminOpen: false,
      userLocation: null,
      userLocationStatus: "idle",
      zoomRequest: null,
      focusRequest: null,

      select: (id, opts) =>
        set((s) => ({
          selectedId: id,
          detailsOpen: id != null ? (opts?.openDetails ?? true) : s.detailsOpen,
        })),
      setHovered: (id) => set({ hoveredId: id }),
      setOrigin: (id, label) =>
        set({ originId: id, originLabel: label, originPoint: null }),
      setOriginPoint: (point, label) =>
        set({ originId: null, originPoint: point, originLabel: label }),
      setDest: (id) => set({ destId: id }),
      setDestPoint: (point, label) =>
        set({ destId: null, destPoint: point, destLabel: label }),
      setRoute: (route, error) => set({ route, routeError: error ?? null }),
      setPickMode: (mode) => set({ pickMode: mode }),
      clearRoute: () =>
        set({
          route: null,
          routeError: null,
          originId: null,
          originPoint: null,
          originLabel: null,
          destId: null,
          destPoint: null,
          destLabel: null,
          pickMode: null,
        }),
      setViewMode: (mode) => set({ viewMode: mode }),
      toggleCategory: (id) =>
        set((s) => ({
          visibleCategories: { ...s.visibleCategories, [id]: !s.visibleCategories[id] },
        })),
      toggleFavorite: (id) =>
        set((s) => ({
          favorites: s.favorites.includes(id)
            ? s.favorites.filter((f) => f !== id)
            : [...s.favorites, id],
        })),
      setDetailsOpen: (open) => set({ detailsOpen: open }),
      setRoutePlannerOpen: (open) => set({ routePlannerOpen: open }),
      setFeedbackOpen: (open) => set({ feedbackOpen: open }),
      setMenuAdminOpen: (open) => set({ menuAdminOpen: open }),
      setUserLocation: (loc, status) => set({ userLocation: loc, userLocationStatus: status }),
      focusOn: (x, z, distance, topDown, phi) =>
        set({ focusRequest: { x, z, distance, topDown, phi } }),
      clearFocus: () => set({ focusRequest: null }),
      zoom: (direction) =>
        set((s) => ({ zoomRequest: { direction, nonce: (s.zoomRequest?.nonce ?? 0) + 1 } })),
      setZoomRequest: (req) => set({ zoomRequest: req }),
    }),
    {
      name: "vitbmap.ui.v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        favorites: s.favorites,
        visibleCategories: s.visibleCategories,
      }),
    }
  )
);
