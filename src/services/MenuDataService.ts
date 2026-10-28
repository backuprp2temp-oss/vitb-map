// MenuDataService — mess/dining menu subsystem.
//
// Data-source adapters are kept separate so a real integration (e.g. an
// authorized campus API) can be added later without rewriting the UI.
// Priority:
//   1. Optional remote adapter (VITE_MENU_API_URL), if configured.
//   2. Administrator-managed menus stored in localStorage.
//   3. Bundled dataset — which ships EMPTY because no verified menu data
//      exists. The UI shows an honest "Menu unavailable" state.

import { bundledMenus, MENU_SECTIONS, type DayMenuData, type MenuSectionData } from "@/data/menus";

const ADMIN_KEY = "vitbmap.menus.admin.v1";

export interface AdminMenusStore {
  /** Weekly templates per outlet: menuId -> dayOfWeek -> sections. */
  weekly: Record<string, Record<string, MenuSectionData[]>>;
  /** Dated menus per outlet: menuId -> "YYYY-MM-DD" -> sections. */
  dated: Record<string, Record<string, MenuSectionData[]>>;
  updatedAt: string;
}

function emptyStore(): AdminMenusStore {
  return { weekly: {}, dated: {}, updatedAt: new Date().toISOString() };
}

export function loadAdminMenus(): AdminMenusStore {
  try {
    const raw = localStorage.getItem(ADMIN_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as AdminMenusStore;
    return { weekly: parsed.weekly ?? {}, dated: parsed.dated ?? {}, updatedAt: parsed.updatedAt ?? new Date().toISOString() };
  } catch {
    return emptyStore();
  }
}

export function saveAdminMenus(store: AdminMenusStore): void {
  try {
    store.updatedAt = new Date().toISOString();
    localStorage.setItem(ADMIN_KEY, JSON.stringify(store));
  } catch {
    // localStorage unavailable (private mode) — admin edits won't persist.
  }
}

function toDayMenu(menuId: string, sections: MenuSectionData[], source: string, verified: boolean): DayMenuData {
  return {
    menuId,
    sections: MENU_SECTIONS.map(
      (s) => sections.find((x) => x.key === s.key) ?? { key: s.key, label: s.label, items: [] }
    ),
    updatedAt: new Date().toISOString().slice(0, 10),
    source,
    verified,
  };
}

export type MenuState = "remote" | "admin" | "unavailable";

export interface MenuLookup {
  state: MenuState;
  menu: DayMenuData | null;
  message: string;
  lastUpdated?: string;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function getMenuFor(menuId: string | null | undefined, date: Date = new Date()): Promise<MenuLookup> {
  if (!menuId) {
    return { state: "unavailable", menu: null, message: "This outlet has no menu identifier." };
  }

  // 1. Optional remote adapter (kept for a future authorized integration).
  const apiUrl = import.meta.env.VITE_MENU_API_URL as string | undefined;
  if (apiUrl) {
    try {
      const res = await fetch(`${apiUrl.replace(/\/$/, "")}/menus?outlet=${encodeURIComponent(menuId)}&date=${isoDate(date)}`);
      if (res.ok) {
        const data = (await res.json()) as DayMenuData;
        if (data && Array.isArray(data.sections)) {
          return { state: "remote", menu: data, message: "From connected menu source.", lastUpdated: data.updatedAt };
        }
      }
    } catch {
      // fall through to local sources
    }
  }

  // 2. Administrator-managed menus (localStorage).
  const admin = loadAdminMenus();
  const ds = isoDate(date);
  const dow = String(date.getDay());
  const datedSections = admin.dated[menuId]?.[ds];
  if (datedSections && datedSections.length > 0) {
    return {
      state: "admin",
      menu: toDayMenu(menuId, datedSections, "Admin-entered menu (local)", true),
      message: "Admin-entered menu (local).",
      lastUpdated: admin.updatedAt.slice(0, 10),
    };
  }
  const weeklySections = admin.weekly[menuId]?.[dow];
  if (weeklySections && weeklySections.length > 0) {
    return {
      state: "admin",
      menu: toDayMenu(menuId, weeklySections, "Admin-entered weekly menu (local)", true),
      message: "Admin-entered weekly menu (local).",
      lastUpdated: admin.updatedAt.slice(0, 10),
    };
  }

  // 3. Bundled dataset — empty by design; no verified public source exists.
  const bundled = bundledMenus.menus.find(
    (m) => m.menuId === menuId && (m.date === ds || m.dayOfWeek === date.getDay())
  );
  if (bundled) {
    return { state: "admin", menu: bundled, message: bundled.source, lastUpdated: bundled.updatedAt };
  }

  return {
    state: "unavailable",
    menu: null,
    message:
      "Menu unavailable — VIT Bhopal does not publish a verified public mess menu. Administrators can add today's menu via the in-app menu editor.",
  };
}

/** Does this outlet have any menu data (admin-entered or remote) right now? */
export function hasAnyMenuData(menuId: string | null | undefined): boolean {
  if (!menuId) return false;
  const admin = loadAdminMenus();
  if (admin.weekly[menuId] && Object.keys(admin.weekly[menuId]).length > 0) return true;
  if (admin.dated[menuId] && Object.keys(admin.dated[menuId]).length > 0) return true;
  return false;
}
