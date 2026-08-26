import { describe, it, expect } from "vitest";

import {
  filterAdminPets,
  matchesAdminPetFilters,
  scopeByArchiveFilter,
} from "@/lib/adminPetFilters";
import { PetStatus, Species } from "@/types/pet";

type Row = {
  id: string;
  name: string;
  breed: string;
  tags: string[];
  species: Species;
  status: PetStatus;
  isArchived: boolean;
};

function row(overrides: Partial<Row> & { id: string }): Row {
  return {
    name: "Tuah",
    breed: "Local Mixed",
    tags: ["gentle"],
    species: "dog",
    status: "Available",
    isArchived: false,
    ...overrides,
  };
}

const ALL: Parameters<typeof filterAdminPets>[1] = {
  globalFilter: "",
  statusFilter: "all",
  speciesFilter: "all",
  archiveFilter: "all",
};

describe("filterAdminPets", () => {
  // The P7 regression: the admin table compared raw strings, so selecting the canonical
  // spelling dropped every animal filed under the legacy alias.
  it("returns both spellings of rehabilitation when the rehab status is selected", () => {
    const pets = [
      row({ id: "a", status: "In Rehabilitation" }),
      row({ id: "b", status: "Rehabilitation" }),
      row({ id: "c", status: "Available" }),
    ];

    const kept = filterAdminPets(pets, { ...ALL, statusFilter: "In Rehabilitation" });

    expect(kept.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("keeps every status when the filter is 'all'", () => {
    const pets = [row({ id: "a", status: "Adopted" }), row({ id: "b", status: "Rehabilitation" })];
    expect(filterAdminPets(pets, ALL)).toHaveLength(2);
  });

  it("hides archived animals under the default active scope", () => {
    const pets = [row({ id: "a" }), row({ id: "b", isArchived: true })];
    const kept = filterAdminPets(pets, { ...ALL, archiveFilter: "active" });
    expect(kept.map((p) => p.id)).toEqual(["a"]);
  });

  it("shows only archived animals under the archived scope", () => {
    const pets = [row({ id: "a" }), row({ id: "b", isArchived: true })];
    const kept = filterAdminPets(pets, { ...ALL, archiveFilter: "archived" });
    expect(kept.map((p) => p.id)).toEqual(["b"]);
  });

  it("filters by species", () => {
    const pets = [row({ id: "a", species: "dog" }), row({ id: "b", species: "cat" })];
    const kept = filterAdminPets(pets, { ...ALL, speciesFilter: "cat" });
    expect(kept.map((p) => p.id)).toEqual(["b"]);
  });

  it("searches name, breed and tags case-insensitively", () => {
    const pets = [
      row({ id: "a", name: "Comel" }),
      row({ id: "b", breed: "Domestic Shorthair" }),
      row({ id: "c", tags: ["tripod"] }),
      row({ id: "d", name: "Kopi", breed: "Local Mixed", tags: ["gentle"] }),
    ];

    expect(filterAdminPets(pets, { ...ALL, globalFilter: "comel" }).map((p) => p.id)).toEqual(["a"]);
    expect(filterAdminPets(pets, { ...ALL, globalFilter: "SHORTHAIR" }).map((p) => p.id)).toEqual(["b"]);
    expect(filterAdminPets(pets, { ...ALL, globalFilter: "tripod" }).map((p) => p.id)).toEqual(["c"]);
  });

  it("ignores a whitespace-only search", () => {
    const pets = [row({ id: "a" }), row({ id: "b" })];
    expect(filterAdminPets(pets, { ...ALL, globalFilter: "   " })).toHaveLength(2);
  });

  it("applies every criterion together", () => {
    const pets = [
      row({ id: "a", species: "cat", status: "Rehabilitation", name: "Comel" }),
      row({ id: "b", species: "dog", status: "Rehabilitation", name: "Comel" }),
      row({ id: "c", species: "cat", status: "Available", name: "Comel" }),
      row({ id: "d", species: "cat", status: "Rehabilitation", name: "Tuah" }),
    ];

    const kept = filterAdminPets(pets, {
      globalFilter: "comel",
      statusFilter: "In Rehabilitation",
      speciesFilter: "cat",
      archiveFilter: "active",
    });

    expect(kept.map((p) => p.id)).toEqual(["a"]);
  });
});

describe("scopeByArchiveFilter", () => {
  // The status counts are drawn over this scope, so they describe the same population the
  // status filter will be applied to rather than a hardcoded "active".
  it("narrows the population the status counts are drawn over", () => {
    const pets = [row({ id: "a" }), row({ id: "b", isArchived: true })];
    expect(scopeByArchiveFilter(pets, "active").map((p) => p.id)).toEqual(["a"]);
    expect(scopeByArchiveFilter(pets, "archived").map((p) => p.id)).toEqual(["b"]);
    expect(scopeByArchiveFilter(pets, "all")).toHaveLength(2);
  });
});

describe("matchesAdminPetFilters", () => {
  const SEARCH = { globalFilter: "", statusFilter: "all", speciesFilter: "all" };

  // Archive scoping is a separate pass so the toolbar can apply it once and reuse the
  // result for both the row list and the status counts, instead of scanning twice.
  it("ignores archive state", () => {
    expect(matchesAdminPetFilters(row({ id: "a", isArchived: true }), SEARCH)).toBe(true);
  });

  it("applies the same status, species and search rules as filterAdminPets", () => {
    const pet = row({ id: "a", status: "Rehabilitation", species: "cat", name: "Comel" });

    expect(matchesAdminPetFilters(pet, { ...SEARCH, statusFilter: "In Rehabilitation" })).toBe(true);
    expect(matchesAdminPetFilters(pet, { ...SEARCH, statusFilter: "Available" })).toBe(false);
    expect(matchesAdminPetFilters(pet, { ...SEARCH, speciesFilter: "dog" })).toBe(false);
    expect(matchesAdminPetFilters(pet, { ...SEARCH, globalFilter: "COMEL" })).toBe(true);
  });
});
