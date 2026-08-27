import { Pet } from "@/types/pet";
import { matchesStatusFilter } from "@/lib/presentation/petStatusPresentation";

/** The three row-level filters, as the toolbar holds them: raw `<select>` / input strings. */
export interface AdminPetSearchCriteria {
  globalFilter: string;
  /** A canonical `PetStatus`, or "all". Compared through `matchesStatusFilter`. */
  statusFilter: string;
  /** A `Species`, or "all". */
  speciesFilter: string;
}

export interface AdminPetFilterCriteria extends AdminPetSearchCriteria {
  /** "active" | "archived" | "all". */
  archiveFilter: string;
}

/** The pet fields the toolbar filters read — kept narrow so tests need no full fixture. */
type FilterablePet = Pick<Pet, "isArchived" | "status" | "species" | "name" | "breed" | "tags">;

/**
 * Narrow a population to the archive scope in force. The status counts are drawn over
 * this rather than a hardcoded "active", so they always describe the same set the row
 * filters are about to be applied to and therefore still sum to the header total.
 */
export function scopeByArchiveFilter<T extends Pick<Pet, "isArchived">>(
  pets: readonly T[],
  archiveFilter: string
): T[] {
  return pets.filter((pet) => {
    if (archiveFilter === "active") return !pet.isArchived;
    if (archiveFilter === "archived") return pet.isArchived;
    return true;
  });
}

/**
 * The row-level predicate: status, species and free-text search. Archive state is
 * deliberately *not* consulted — `scopeByArchiveFilter` handles that dimension once, so
 * the toolbar can reuse one scoped array for both the rows and the status counts.
 *
 * The status comparison used to be `pet.status !== statusFilter` inside
 * `usePetTableController`, which silently dropped animals stored under the legacy
 * `Rehabilitation` alias whenever the canonical spelling was selected — the defect P7
 * exists to fix, and one no badge-level test could have caught.
 */
export function matchesAdminPetFilters(
  pet: FilterablePet,
  criteria: AdminPetSearchCriteria
): boolean {
  if (!matchesStatusFilter(pet.status, criteria.statusFilter)) return false;

  if (criteria.speciesFilter !== "all" && pet.species !== criteria.speciesFilter) return false;

  const query = criteria.globalFilter.trim().toLowerCase();
  if (query === "") return true;

  return (
    pet.name.toLowerCase().includes(query) ||
    pet.breed.toLowerCase().includes(query) ||
    pet.tags.some((tag) => tag.toLowerCase().includes(query))
  );
}

/** Every admin toolbar filter in one pass — archive scope first, then the row predicate. */
export function filterAdminPets<T extends FilterablePet>(
  pets: readonly T[],
  criteria: AdminPetFilterCriteria
): T[] {
  return scopeByArchiveFilter(pets, criteria.archiveFilter).filter((pet) =>
    matchesAdminPetFilters(pet, criteria)
  );
}
