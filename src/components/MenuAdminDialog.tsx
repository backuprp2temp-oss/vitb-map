// MenuAdminDialog — administrator editor for mess menus. Stores dated and
// weekly menus in localStorage. This is the fallback data-entry mechanism
// until an authorized campus menu source is available.

import { useEffect, useState } from "react";
import {
  loadAdminMenus,
  saveAdminMenus,
} from "@/services/MenuDataService";
import {
  MENU_SECTIONS,
  bundledMenus,
  type MenuSectionData,
} from "@/data/menus";
import { useMapStore } from "@/state/store";

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function MenuAdminDialog() {
  const open = useMapStore((s) => s.menuAdminOpen);
  const setOpen = useMapStore((s) => s.setMenuAdminOpen);
  const outlets = bundledMenus.outlets;
  const [menuId, setMenuId] = useState(outlets[0]?.menuId ?? "");
  const [mode, setMode] = useState<"weekly" | "dated">("weekly");
  const [date, setDate] = useState(isoDate(new Date()));
  const [dayOfWeek, setDayOfWeek] = useState(new Date().getDay());
  const [sectionKey, setSectionKey] = useState<MenuSectionData["key"]>("dinner");
  const [itemsText, setItemsText] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (!open) return;
    const store = loadAdminMenus();
    const key = mode === "weekly" ? String(dayOfWeek) : date;
    const sections =
      mode === "weekly" ? store.weekly[menuId]?.[key] : store.dated[menuId]?.[key];
    const items = sections?.find((s) => s.key === sectionKey)?.items ?? [];
    setItemsText(items.join("\n"));
  }, [open, menuId, mode, date, dayOfWeek, sectionKey]);

  if (!open) return null;

  const save = (itemsOverride?: string[]) => {
    const store = loadAdminMenus();
    const key = mode === "weekly" ? String(dayOfWeek) : date;
    const items = itemsOverride ?? itemsText
      .split("\n")
      .map((s: string) => s.trim())
      .filter(Boolean);
    const bucket = store.weekly[menuId] ?? (store.weekly[menuId] = {});
    const datedBucket = mode === "dated" ? store.dated[menuId] ?? (store.dated[menuId] = {}) : null;
    const target = mode === "dated" ? datedBucket! : bucket;
    let sections = target[key] ?? [];
    const existing = sections.find((s) => s.key === sectionKey);
    if (existing) existing.items = items;
    else sections = [...sections, { key: sectionKey, label: sectionKey, items }];
    target[key] = sections;
    saveAdminMenus(store);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  const clearSection = () => {
    setItemsText("");
    save([]);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Menu editor"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="glass slim-scroll max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-100">✏️ Menu editor (admin)</h2>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close menu editor"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-700 hover:text-ink-200"
          >
            ✕
          </button>
        </div>
        <p className="mb-3 text-[11px] leading-relaxed text-ink-500">
          Menus are stored in this browser (localStorage). Add real menus here —
          they will show as "Admin-entered menu" in the dining panel. Do not enter
          invented menus as official data.
        </p>

        <label className="mb-1 block text-[11px] font-medium text-ink-400">Outlet</label>
        <select
          value={menuId}
          onChange={(e) => setMenuId(e.target.value)}
          className="dark-select mb-3 w-full rounded-lg border border-ink-600 px-2.5 py-2 text-xs outline-none"
        >
          {outlets.map((o) => (
            <option key={o.menuId} value={o.menuId}>
              {o.name}
            </option>
          ))}
        </select>

        <div className="mb-2 flex gap-1.5">
          <button
            onClick={() => setMode("weekly")}
            className={`flex-1 rounded-md border px-2 py-1.5 text-[11px] font-medium ${
              mode === "weekly" ? "border-accent bg-accent-dim text-white" : "border-ink-600 bg-ink-800 text-ink-300"
            }`}
          >
            Weekly template
          </button>
          <button
            onClick={() => setMode("dated")}
            className={`flex-1 rounded-md border px-2 py-1.5 text-[11px] font-medium ${
              mode === "dated" ? "border-accent bg-accent-dim text-white" : "border-ink-600 bg-ink-800 text-ink-300"
            }`}
          >
            Specific date
          </button>
        </div>

        {mode === "weekly" ? (
          <select
            value={dayOfWeek}
            onChange={(e) => setDayOfWeek(Number(e.target.value))}
            className="dark-select mb-3 w-full rounded-lg border border-ink-600 px-2.5 py-2 text-xs outline-none"
            aria-label="Day of week"
          >
            {DAYS.map((d, i) => (
              <option key={i} value={i}>
                Every {d}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="dark-select mb-3 w-full rounded-lg border border-ink-600 px-2.5 py-2 text-xs outline-none"
            aria-label="Menu date"
          />
        )}

        <label className="mb-1 block text-[11px] font-medium text-ink-400">Meal section</label>
        <div className="mb-2 flex gap-1">
          {MENU_SECTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSectionKey(s.key)}
              className={`flex-1 rounded-md border px-1 py-1.5 text-[10px] font-medium ${
                sectionKey === s.key
                  ? "border-accent bg-accent-dim text-white"
                  : "border-ink-600 bg-ink-800 text-ink-300"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <label className="mb-1 block text-[11px] font-medium text-ink-400">
          Items (one per line)
        </label>
        <textarea
          value={itemsText}
          onChange={(e) => setItemsText(e.target.value)}
          rows={5}
          placeholder={"e.g.\nChapati\nRajma\nRice"}
          className="dark-select mb-3 w-full rounded-lg border border-ink-600 px-2.5 py-2 text-xs outline-none"
        />

        <div className="flex items-center gap-2">
          <button
            onClick={() => save()}
            className="flex-1 rounded-lg border border-accent/50 bg-accent-dim px-3 py-2 text-xs font-semibold text-[#a8c9f5] hover:bg-accent/25"
          >
            {savedFlash ? "✓ Saved" : "Save"}
          </button>
          <button
            onClick={clearSection}
            className="rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-xs text-ink-300 hover:border-[#6e3d40] hover:text-[#f0aeae]"
          >
            Clear section
          </button>
        </div>
      </div>
    </div>
  );
}
