// Bundled mess/dining menu data for VITmap Bhopal.
//
// HONESTY NOTE: VIT Bhopal does not publish a machine-readable mess menu.
// No verified menu data exists, so this dataset ships EMPTY on purpose —
// the app shows a clear "Menu unavailable" state rather than inventing
// meals. Administrators can add dated/weekly menus via the in-app menu
// editor (stored in localStorage), or wire a real source through
// VITE_MENU_API_URL (see MenuDataService).

export interface MenuSectionData {
  key: "breakfast" | "lunch" | "snacks" | "dinner";
  label: string;
  /** Verified serving time window, if known. */
  timing?: string;
  items: string[];
}

export interface DayMenuData {
  menuId: string;
  /** ISO date "YYYY-MM-DD" for a dated menu. */
  date?: string;
  /** Day of week 0 (Sunday) - 6 (Saturday) for a weekly template. */
  dayOfWeek?: number;
  sections: MenuSectionData[];
  updatedAt: string;
  source: string;
  verified: boolean;
}

export interface MenuOutletData {
  menuId: string;
  name: string;
  category?: string;
  verified: boolean;
  note?: string;
}

export interface MenusDataset {
  outlets: MenuOutletData[];
  /** Dated + weekly menus. Ships empty (no verified data). */
  menus: DayMenuData[];
}

export const MENU_SECTIONS: { key: MenuSectionData["key"]; label: string }[] = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "snacks", label: "Snacks" },
  { key: "dinner", label: "Dinner" },
];

export const bundledMenus: MenusDataset = {
  outlets: [
    {
      menuId: "boys-hostel-mess",
      name: "Boys Hostel Mess (Mayuri)",
      category: "mess",
      verified: false,
      note: "VIT Bhopal does not publish a public machine-readable mess menu. Menus can be added by administrators via the in-app editor.",
    },
    {
      menuId: "mayuri-cafe",
      name: "Mayuri Cafe",
      category: "cafe",
      verified: false,
    },
    {
      menuId: "bistro",
      name: "Bistro",
      category: "restaurant",
      verified: false,
    },
    {
      menuId: "ab-dakshin",
      name: "AB Dakshin",
      category: "restaurant",
      verified: false,
    },
    {
      menuId: "underbelly",
      name: "Underbelly",
      category: "restaurant",
      verified: false,
    },
    {
      menuId: "mayuri-lab-complex",
      name: "Mayuri (Lab Complex)",
      category: "restaurant",
      verified: false,
    },
  ],
  menus: [],
};
