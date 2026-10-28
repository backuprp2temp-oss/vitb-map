// Category metadata: labels, icons, 3D + UI colors, defaults.

export type CategoryId =
  | "academic"
  | "hostel"
  | "food"
  | "sports"
  | "service"
  | "medical"
  | "study"
  | "event"
  | "residence"
  | "campus"
  | "facility"
  | "other";

export interface CategoryMeta {
  id: CategoryId;
  label: string;
  icon: string;
  /** Pin / marker color in the 3D scene (muted, dark-theme friendly). */
  color: string;
  /** Tailwind text+border classes for chips. */
  chipClass: string;
  defaultVisible: boolean;
}

export const CATEGORIES: CategoryMeta[] = [
  { id: "academic", label: "Academic", icon: "🏛", color: "#7fa8d9", chipClass: "text-[#a8c6ec] border-[#3d5a7d] bg-[#16222e]", defaultVisible: true },
  { id: "hostel", label: "Hostels", icon: "🛏", color: "#d9a066", chipClass: "text-[#ecc79c] border-[#6e5433] bg-[#241d15]", defaultVisible: true },
  { id: "food", label: "Food & Mess", icon: "🍽", color: "#e0876a", chipClass: "text-[#f0b7a3] border-[#6e4433] bg-[#261915]", defaultVisible: true },
  { id: "sports", label: "Sports", icon: "⚽", color: "#7fbf7f", chipClass: "text-[#aad8aa] border-[#3d613d] bg-[#15241a]", defaultVisible: true },
  { id: "service", label: "Services", icon: "🧰", color: "#b0a8c9", chipClass: "text-[#cfc9dd] border-[#4e4a61] bg-[#1c1a24]", defaultVisible: true },
  { id: "medical", label: "Medical", icon: "➕", color: "#e07a7f", chipClass: "text-[#f0aeae] border-[#6e3d40] bg-[#261617]", defaultVisible: true },
  { id: "study", label: "Study", icon: "📚", color: "#d9c76a", chipClass: "text-[#e8dfa0] border-[#6e6433] bg-[#242215]", defaultVisible: true },
  { id: "event", label: "Events", icon: "🎭", color: "#c98fd9", chipClass: "text-[#dfb7ec] border-[#5c3d6e] bg-[#201526]", defaultVisible: true },
  { id: "residence", label: "Residences", icon: "🏠", color: "#a8b8a0", chipClass: "text-[#c9d6c6] border-[#4a5545] bg-[#1a2018]", defaultVisible: true },
  { id: "campus", label: "Campus", icon: "🏫", color: "#4f9cf9", chipClass: "text-[#a8c9f5] border-[#2f5680] bg-[#131f2e]", defaultVisible: true },
  { id: "facility", label: "Facilities", icon: "📍", color: "#8fa3ad", chipClass: "text-[#bccbd6] border-[#44525c] bg-[#181e24]", defaultVisible: true },
  { id: "other", label: "Other", icon: "📍", color: "#8fa3ad", chipClass: "text-[#bccbd6] border-[#44525c] bg-[#181e24]", defaultVisible: true },
];

export const CATEGORY_BY_ID: Record<string, CategoryMeta> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c])
);

export function categoryMeta(id: string | null | undefined): CategoryMeta {
  return CATEGORY_BY_ID[id ?? "other"] ?? CATEGORY_BY_ID.other;
}
