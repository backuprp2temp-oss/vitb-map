// Floating campus search bar with dropdown results, keyboard navigation,
// favorites quick-access and honest empty states.

import { useEffect, useRef, useState } from "react";
import { searchPlaces, resultDescriptor, type SearchResult } from "@/services/SearchService";
import { projector, searchableById } from "@/services/CampusDataService";
import { useMapStore } from "@/state/store";
import { categoryMeta } from "@/data/categories";

export function useFocusPlace() {
  const select = useMapStore((s) => s.select);
  const focusOn = useMapStore((s) => s.focusOn);
  return (id: string | null) => {
    const sp = searchableById(id);
    if (!sp) return;
    select(id);
    if (sp.lat != null && sp.lon != null) {
      const [x, z] = projector.project(sp.lat, sp.lon);
      focusOn(x, z, 260);
    }
  };
}

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const focusPlace = useFocusPlace();
  const favorites = useMapStore((s) => s.favorites);
  const setFeedbackOpen = useMapStore((s) => s.setFeedbackOpen);

  useEffect(() => {
    setResults(searchPlaces(query));
    setActiveIdx(0);
  }, [query]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const choose = (r: SearchResult) => {
    focusPlace(r.id);
    setOpen(false);
    setQuery(r.name);
  };

  const favoritePlaces = favorites
    .map((id) => searchableById(id))
    .filter((sp): sp is NonNullable<typeof sp> => sp != null)
    .slice(0, 6);

  return (
    <div ref={boxRef} className="relative w-full">
      <div className="glass flex items-center gap-2 rounded-xl px-3 py-2 shadow-lg shadow-black/40">
        <span aria-hidden className="text-ink-400">🔍</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIdx((i) => Math.min(i + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIdx((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && results[activeIdx]) {
              choose(results[activeIdx]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Search buildings, hostels, mess, ATMs…"
          aria-label="Search campus places"
          className="w-full bg-transparent text-sm text-ink-200 placeholder-ink-500 outline-none"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="rounded-md px-1.5 py-0.5 text-ink-400 hover:bg-ink-700 hover:text-ink-200"
          >
            ✕
          </button>
        )}
      </div>

      {open && (
        <div className="glass slim-scroll absolute left-0 right-0 top-full z-40 mt-2 max-h-[60vh] overflow-y-auto rounded-xl shadow-xl shadow-black/50">
          {query.trim() === "" ? (
            <div className="p-2">
              {favoritePlaces.length > 0 && (
                <>
                  <div className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                    ⭐ Favorites
                  </div>
                  <div className="flex flex-wrap gap-1.5 px-2 pb-2">
                    {favoritePlaces.map((sp) => (
                      <button
                        key={sp.id}
                        onClick={() => {
                          focusPlace(sp.id);
                          setOpen(false);
                        }}
                        className="rounded-lg border border-ink-600 bg-ink-800 px-2.5 py-1.5 text-xs text-ink-200 hover:border-accent hover:text-white"
                      >
                        {categoryMeta(sp.category).icon} {sp.name.slice(0, 22)}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <div className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                Popular places
              </div>
              {[
                "osm-rel-16248225",
                "osm-node-11515616398",
                "central-library",
                "osm-way-1120857899",
                "osm-node-12685733586",
              ].map((id) => {
                const sp = searchableById(id);
                if (!sp) return null;
                return (
                  <button
                    key={id}
                    onClick={() => {
                      focusPlace(id);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-ink-700/60"
                  >
                    <span aria-hidden>{categoryMeta(sp.category).icon}</span>
                    <span>
                      <span className="block text-sm text-ink-200">{sp.name}</span>
                      <span className="block text-[11px] text-ink-500">{resultDescriptor(sp)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-sm text-ink-300">
                No results for <span className="font-semibold text-ink-100">“{query}”</span>
              </p>
              <p className="mt-1 text-xs text-ink-500">
                This place may not be mapped yet. Room-level data is not available on campus.
              </p>
              <button
                onClick={() => setFeedbackOpen(true)}
                className="mt-3 rounded-lg border border-ink-600 bg-ink-800 px-3 py-1.5 text-xs text-ink-200 hover:border-accent hover:text-white"
              >
                Report a missing place
              </button>
            </div>
          ) : (
            <ul role="listbox" aria-label="Search results">
              {results.map((r, i) => {
                const meta = categoryMeta(r.category);
                return (
                  <li key={r.id} role="option" aria-selected={i === activeIdx}>
                    <button
                      onClick={() => choose(r)}
                      onMouseEnter={() => setActiveIdx(i)}
                      className={`flex w-full items-center gap-2.5 px-2.5 py-2 text-left ${
                        i === activeIdx ? "bg-ink-700/60" : ""
                      }`}
                    >
                      <span
                        aria-hidden
                        className="h-2 w-2 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: meta.color }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-ink-100">
                          {r.name}
                          {favorites.includes(r.id) && <span className="ml-1">⭐</span>}
                        </span>
                        <span className="block truncate text-[11px] text-ink-500">
                          {resultDescriptor(r)}
                        </span>
                      </span>
                      <span aria-hidden className="text-[10px] text-ink-600">↵</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
