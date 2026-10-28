// SearchService — fast campus-specific search built on MiniSearch.
// Indexes buildings + POIs with names, common names, aliases and categories.
// Supports partial matches, spelling variations (fuzzy) and aliases.

import MiniSearch from "minisearch";
import { categoryMeta } from "@/data/categories";
import { searchablePlaces, type SearchablePlace } from "./CampusDataService";

const mini = new MiniSearch<SearchablePlace>({
  idField: "id",
  fields: ["name", "commonName", "aliases", "category", "subcategory"],
  storeFields: ["id"],
  searchOptions: {
    fuzzy: 0.2,
    prefix: true,
    boost: { name: 3, commonName: 2.5, aliases: 2, subcategory: 1 },
  },
});

mini.addAll(searchablePlaces);

export interface SearchOptions {
  limit?: number;
}

export interface SearchResult extends SearchablePlace {
  score: number;
}

export function searchPlaces(rawQuery: string, options: SearchOptions = {}): SearchResult[] {
  const limit = options.limit ?? 8;
  const query = rawQuery.trim();
  if (!query) return [];

  // Every query token must match somewhere (AND semantics across tokens):
  // prevents "room 327" from matching a "reading room" alias, keeping
  // room-number queries honestly empty while preserving OR-based scoring.
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  let allowed: Set<string> | null = null;
  for (const t of tokens) {
    const tokenIds = new Set(mini.search(t).map((r) => r.id));
    allowed = allowed ? new Set([...allowed].filter((id) => tokenIds.has(id))) : tokenIds;
    if (allowed.size === 0) return [];
  }

  const raw = mini.search(query);
  const results: SearchResult[] = [];
  for (const r of raw) {
    if (!allowed!.has(r.id)) continue;
    const sp = searchablePlaces.find((s) => s.id === r.id);
    if (!sp) continue;
    // Small exact/prefix name bonus for better ranking of e.g. "mess".
    const q = query.toLowerCase();
    const n = sp.name.toLowerCase();
    let score = r.score;
    if (n === q || sp.aliases.some((a) => a.toLowerCase() === q)) score += 5;
    else if (n.startsWith(q)) score += 2;
    results.push({ ...sp, score });
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

/** Human-readable descriptor for a result row, e.g. "Academic · 5 floors". */
export function resultDescriptor(sp: SearchablePlace): string {
  const cat = categoryMeta(sp.category).label;
  const parts = [cat];
  if (sp.kind === "building") {
    const b = sp.place as import("@/types/campus").Building;
    const levels = b.levels ?? b.estimatedLevels;
    if (levels) parts.push(levels === 1 ? "1 floor" : `${levels} floors`);
  }
  if (sp.subcategory) parts.push(sp.subcategory.replace(/-/g, " "));
  return parts.join(" · ");
}
