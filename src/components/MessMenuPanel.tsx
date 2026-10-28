// MessMenuPanel — dining info for food places. Answers "what's for dinner
// today?" honestly: shows admin-entered menus when present, otherwise a
// clear "Menu unavailable" state with a path to fix it.

import { useEffect, useState } from "react";
import { getMenuFor, type MenuLookup } from "@/services/MenuDataService";
import { MENU_SECTIONS, type MenuSectionData } from "@/data/menus";
import { useMapStore } from "@/state/store";

export default function MessMenuPanel({ menuId, placeName }: { menuId: string | null; placeName: string }) {
  const menuAdminOpen = useMapStore((s) => s.menuAdminOpen);
  const setMenuAdminOpen = useMapStore((s) => s.setMenuAdminOpen);
  const [lookup, setLookup] = useState<MenuLookup | null>(null);
  const [section, setSection] = useState<MenuSectionData["key"]>("dinner");

  useEffect(() => {
    let cancelled = false;
    setLookup(null);
    getMenuFor(menuId).then((l) => {
      if (!cancelled) setLookup(l);
    });
    return () => {
      cancelled = true;
    };
  }, [menuId, menuAdminOpen]);

  if (!menuId) return null;

  return (
    <div>
      <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
        Menu — {placeName}
      </h3>
      {!lookup ? (
        <p className="text-xs text-ink-500">Loading menu…</p>
      ) : lookup.state === "unavailable" || !lookup.menu ? (
        <div className="rounded-lg border border-ink-700/60 bg-ink-850/60 px-3 py-2.5">
          <p className="text-xs text-ink-400">{lookup.message}</p>
          <button
            onClick={() => setMenuAdminOpen(true)}
            className="mt-2 rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-[11px] text-ink-200 hover:border-accent hover:text-white"
          >
            ✏️ Edit menus (admin)
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-ink-700/60 bg-ink-850/60 px-3 py-2.5">
          <div className="mb-2 flex gap-1">
            {MENU_SECTIONS.map((s) => {
              const items = lookup.menu?.sections.find((x) => x.key === s.key)?.items ?? [];
              const hasItems = items.length > 0;
              return (
                <button
                  key={s.key}
                  onClick={() => setSection(s.key)}
                  className={`flex-1 rounded-md border px-1 py-1 text-[10px] font-medium ${
                    section === s.key
                      ? "border-accent bg-accent-dim text-white"
                      : hasItems
                        ? "border-ink-600 bg-ink-800 text-ink-300"
                        : "border-ink-700/60 bg-ink-850 text-ink-600"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          {(() => {
            const sec = lookup.menu?.sections.find((x) => x.key === section);
            if (!sec || sec.items.length === 0) {
              return (
                <p className="text-xs text-ink-500">
                  No {section} items listed for today.
                </p>
              );
            }
            return (
              <>
                <ul className="space-y-0.5">
                  {sec.items.map((item, i) => (
                    <li key={i} className="text-xs text-ink-200">
                      • {item}
                    </li>
                  ))}
                </ul>
                {sec.timing && (
                  <p className="mt-1.5 text-[10px] text-ink-500">🕒 {sec.timing}</p>
                )}
              </>
            );
          })()}
          <p className="mt-1.5 text-[10px] text-ink-600">
            {lookup.menu.verified ? "✅" : "⚠️"} {lookup.message}
            {lookup.lastUpdated && ` · updated ${lookup.lastUpdated}`}
          </p>
          <button
            onClick={() => setMenuAdminOpen(true)}
            className="mt-2 rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-[11px] text-ink-300 hover:border-accent hover:text-white"
          >
            ✏️ Edit menus (admin)
          </button>
        </div>
      )}
    </div>
  );
}
