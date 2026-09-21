import type { Pet } from "@/types/pet";

/**
 * The one rule for whether a pet matches a free-text catalogue search.
 *
 * There used to be two: `getPublicPets` on the server and the gallery's client-side matcher. They
 * were written the same and drifted — the client trimmed the query and the server did not, so
 * `" Luna"` found Luna in the gallery and nothing from the action. Fixing that by editing one copy
 * would only have reset the clock on the next drift (matching `rescueStory`, folding diacritics),
 * so both now call this.
 *
 * An empty or all-whitespace query matches everything: "no search" is not "search for nothing".
 */
export function matchesPetSearch(
  pet: Pick<Pet, "name" | "breed" | "description" | "tags">,
  query: string
): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === "") return true;
  return (
    pet.name.toLowerCase().includes(needle) ||
    pet.breed.toLowerCase().includes(needle) ||
    pet.description.toLowerCase().includes(needle) ||
    pet.tags.some((tag) => tag.toLowerCase().includes(needle))
  );
}
