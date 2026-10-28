// Favorites quick-access chips (persisted via localStorage through the store).

import { searchableById } from "@/services/CampusDataService";
import { useMapStore } from "@/state/store";
import { useFocusPlace } from "./SearchBar";

export default function FavoritesPanel() {
  const favorites = useMapStore((s) => s.favorites);
  const toggleFavorite = useMapStore((s) => s.toggleFavorite);
  const focusPlace = useFocusPlace();

  if (favorites.length === 0) return null;

  const places = favorites
    .map((id) => searchableById(id))
    .filter((sp): sp is NonNullable<typeof sp> => sp != null);

  return (
    <div
      className="slim-scroll flex gap-1.5 overflow-x-auto pb-0.5"
      role="group"
      aria-label="Favorite places"
    >
      {places.map((sp) => (
        <span key={sp.id} className="flex flex-shrink-0 items-center">
          <button
            onClick={() => focusPlace(sp.id)}
            title={`Go to ${sp.name}`}
            className="whitespace-nowrap rounded-l-full border border-r-0 border-[#6e5433] bg-[#241d15] px-2.5 py-1 text-[11px] font-medium text-[#ecc79c] hover:border-accent hover:text-white"
          >
            ⭐ {sp.name.slice(0, 20)}
          </button>
          <button
            onClick={() => toggleFavorite(sp.id)}
            aria-label={`Unstar ${sp.name}`}
            title="Unstar"
            className="whitespace-nowrap rounded-r-full border border-l-0 border-[#6e5433] bg-[#241d15] px-1.5 py-1 text-[11px] text-[#ecc79c]/70 hover:text-[#e07a7f]"
          >
            ✕
          </button>
        </span>
      ))}
    </div>
  );
}
