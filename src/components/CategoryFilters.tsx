// Category filter chips — toggle place categories on the 3D map.

import { CATEGORIES } from "@/data/categories";
import { useMapStore } from "@/state/store";

export default function CategoryFilters() {
  const visibleCategories = useMapStore((s) => s.visibleCategories);
  const toggleCategory = useMapStore((s) => s.toggleCategory);

  return (
    <div
      className="slim-scroll flex gap-1.5 overflow-x-auto pb-0.5"
      role="group"
      aria-label="Filter place categories"
    >
      {CATEGORIES.filter((c) => c.id !== "other").map((c) => {
        const active = visibleCategories[c.id] !== false;
        return (
          <button
            key={c.id}
            onClick={() => toggleCategory(c.id)}
            aria-pressed={active}
            title={`${active ? "Hide" : "Show"} ${c.label}`}
            className={`flex-shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
              active ? c.chipClass : "border-ink-700 bg-ink-900/60 text-ink-500 line-through"
            }`}
          >
            {c.icon} {c.label}
          </button>
        );
      })}
    </div>
  );
}
