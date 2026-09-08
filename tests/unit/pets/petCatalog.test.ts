import { describe, it, expect, beforeEach } from "vitest";

import {
  PET_TRACK_SEQUENCE,
  buildPetStatusFilterOptions,
  buildPetTrackOptions,
  buildPopulatedStatusFilterOptions,
  getPetTrack,
  matchesTrackFilter,
  type PetTrack,
} from "@/lib/presentation/petStatusPresentation";
import { PET_STATUS_VALUES } from "@/lib/validations/pet";
import { insertServerPet } from "@/lib/server/petRepository";
import { getPublicPets, getPetById } from "@/actions/pets";
import { signInAsAdmin, TEST_ADMIN_ACTOR } from "../../setup/authSession";
import { Pet, PetStatus } from "@/types/pet";

/**
 * The catalogue's two derived axes: the track tab strip, and the status options scoped inside
 * it. Both are built from the population on screen rather than hand-listed, which is the
 * property these tests exist to hold — the public gallery previously hand-listed three of the
 * four statuses and omitted "Adopted", the same omission `buildPetStatusFilterOptions` was
 * written after it happened to the admin table.
 */

function makeCatalogPet(overrides: Partial<Pet> = {}): Pet {
  return {
    id: "pet-catalog-001",
    name: "Comel",
    species: "dog",
    breed: "Malaysian Local Mixed",
    age: "2 years",
    ageCategory: "adult",
    gender: "Female",
    size: "Medium",
    weight: "12 kg",
    tags: ["Gentle"],
    description: "Surrendered by a family relocating out of Selangor.",
    rescueStory: "Handed in at the PJ shelter gate in March 2026.",
    image: "https://images.hopeforstrays.org/comel.jpg",
    status: "Available",
    medical: {
      vaccinated: true,
      microchipped: true,
      spayedNeutered: true,
    },
    compatibility: {
      goodWithDogs: true,
      goodWithCats: true,
      goodWithKids: true,
      energyLevel: "Moderate",
    },
    intakeDate: "2026-03-11",
    adoptionFee: "RM 150",
    ...overrides,
  };
}

/** A population is only ever described by status here; nothing else affects a track. */
function population(...statuses: PetStatus[]): { status: PetStatus }[] {
  return statuses.map((status) => ({ status }));
}

describe("getPetTrack", () => {
  it("files Available and Pending under one adoptable track", () => {
    // Pending is a stage of the adoption journey, not a section of its own. The detail page
    // already renders it as "Adoption Pending" on the adopt button rather than hiding the
    // button, and the catalogue has to agree with the page it links to.
    expect(getPetTrack("Available")).toBe("adoptable");
    expect(getPetTrack("Pending")).toBe("adoptable");
  });

  it("files both rehabilitation spellings under the rehabilitation track", () => {
    // The legacy alias must be indistinguishable, or animals stored under one spelling
    // disappear from the tab that exists for them.
    expect(getPetTrack("In Rehabilitation")).toBe("rehabilitation");
    expect(getPetTrack("Rehabilitation")).toBe("rehabilitation");
  });

  it("files Adopted under alumni", () => {
    expect(getPetTrack("Adopted")).toBe("alumni");
  });

  it("gives every declared status a track in the declared sequence", () => {
    // The non-brittleness claim, stated as a test: a status added to PRESENTATIONS without a
    // usable track would fail here rather than silently vanishing from every tab. This is the
    // check that makes "add one field and the UI follows" true rather than aspirational.
    for (const status of PET_STATUS_VALUES) {
      expect(PET_TRACK_SEQUENCE).toContain(getPetTrack(status));
    }
  });
});

describe("buildPetTrackOptions", () => {
  it("omits tracks nobody is in", () => {
    // A shelter that has never rehomed an animal must not be shown an "Adopted" tab that
    // leads to an empty grid.
    const options = buildPetTrackOptions(population("Available", "Available"));

    expect(options.map((option) => option.value)).toEqual(["adoptable"]);
  });

  it("counts every supplied animal exactly once", () => {
    const pets = population("Available", "Pending", "In Rehabilitation", "Rehabilitation", "Adopted");

    const total = buildPetTrackOptions(pets).reduce((sum, option) => sum + option.count, 0);

    expect(total).toBe(pets.length);
  });

  it("counts the two adoptable statuses together and both rehab spellings together", () => {
    const options = buildPetTrackOptions(
      population("Available", "Pending", "In Rehabilitation", "Rehabilitation", "Adopted")
    );
    const countFor = (track: PetTrack) => options.find((o) => o.value === track)?.count;

    expect(countFor("adoptable")).toBe(2);
    expect(countFor("rehabilitation")).toBe(2);
    expect(countFor("alumni")).toBe(1);
  });

  it("offers adoption first and alumni last", () => {
    const options = buildPetTrackOptions(population("Adopted", "In Rehabilitation", "Available"));

    // Ordering follows PET_TRACK_SEQUENCE, not the order animals happen to arrive in.
    expect(options.map((option) => option.value)).toEqual([
      "adoptable",
      "rehabilitation",
      "alumni",
    ]);
  });

  it("returns nothing for an empty population", () => {
    expect(buildPetTrackOptions([])).toEqual([]);
  });

  it("labels tracks with their own keys rather than borrowing a status label", () => {
    const options = buildPetTrackOptions(population("Available", "In Rehabilitation", "Adopted"));

    // "Adoptable" spans Available and Pending, so it cannot borrow either one's key without
    // becoming wrong the moment the other is the only one present.
    expect(options.map((option) => option.labelKey)).toEqual([
      "pets.trackAdoptable",
      "pets.trackRehabilitation",
      "pets.trackAlumni",
    ]);
  });
});

describe("matchesTrackFilter", () => {
  it("matches everything under the default", () => {
    // "all" is the default rather than "adoptable" because PetGallery also mounts on the home
    // page without filter controls; a track default would silently hide animals under care.
    for (const status of PET_STATUS_VALUES) {
      expect(matchesTrackFilter(status, "all")).toBe(true);
    }
  });

  it("keeps a Pending animal inside the adoptable track", () => {
    expect(matchesTrackFilter("Pending", "adoptable")).toBe(true);
    expect(matchesTrackFilter("Pending", "rehabilitation")).toBe(false);
  });

  it("matches the legacy alias against the rehabilitation track", () => {
    expect(matchesTrackFilter("Rehabilitation", "rehabilitation")).toBe(true);
  });

  it("excludes an adopted animal from both support tracks", () => {
    expect(matchesTrackFilter("Adopted", "adoptable")).toBe(false);
    expect(matchesTrackFilter("Adopted", "rehabilitation")).toBe(false);
    expect(matchesTrackFilter("Adopted", "alumni")).toBe(true);
  });
});

describe("buildPopulatedStatusFilterOptions", () => {
  it("drops the empty buckets that the admin builder deliberately keeps", () => {
    const pets = population("Available", "Available");

    const admin = buildPetStatusFilterOptions(pets);
    const publicFacing = buildPopulatedStatusFilterOptions(pets);

    // Staff want to see that a bucket is empty; a visitor wants no filter that matches
    // nothing. Two named policies over one count, rather than a `.filter()` remembered at
    // one of the two call sites.
    expect(admin.length).toBeGreaterThan(publicFacing.length);
    expect(publicFacing.map((option) => option.value)).toEqual(["Available"]);
  });

  it("never offers an option that would empty the grid", () => {
    const options = buildPopulatedStatusFilterOptions(
      population("Available", "Pending", "Adopted")
    );

    expect(options.every((option) => option.count > 0)).toBe(true);
  });
});

describe("public catalogue reads", () => {
  beforeEach(async () => {
    // insertServerPet records an actor; the catalogue reads below are themselves public.
    await signInAsAdmin();
  });

  it("filters by gender", async () => {
    await insertServerPet(
      makeCatalogPet({ id: "pet-catalog-gender-f", name: "Comel", gender: "Female" }),
      TEST_ADMIN_ACTOR
    );
    await insertServerPet(
      makeCatalogPet({ id: "pet-catalog-gender-m", name: "Bujang", gender: "Male" }),
      TEST_ADMIN_ACTOR
    );

    const females = await getPublicPets({ gender: "Female" });
    const males = await getPublicPets({ gender: "Male" });

    expect(females.some((p) => p.id === "pet-catalog-gender-f")).toBe(true);
    expect(females.some((p) => p.id === "pet-catalog-gender-m")).toBe(false);
    expect(males.some((p) => p.id === "pet-catalog-gender-m")).toBe(true);
    expect(females.every((p) => p.gender === "Female")).toBe(true);
  });

  it("treats an absent gender filter as no filter", async () => {
    await insertServerPet(
      makeCatalogPet({ id: "pet-catalog-gender-any", gender: "Male" }),
      TEST_ADMIN_ACTOR
    );

    const all = await getPublicPets();

    expect(all.some((p) => p.id === "pet-catalog-gender-any")).toBe(true);
  });

  it("does not let the gender filter resurrect an archived animal", async () => {
    // The archive check has to precede every other predicate. The sibling assertion for
    // species/status/search lives in tests/integration/softDeleteFiltering.ts; gender is the
    // new predicate, so it gets the same treatment.
    await insertServerPet(
      makeCatalogPet({ id: "pet-catalog-archived-f", gender: "Female", isArchived: true }),
      TEST_ADMIN_ACTOR
    );

    expect(await getPublicPets({ gender: "Female" })).not.toContainEqual(
      expect.objectContaining({ id: "pet-catalog-archived-f" })
    );
  });
});

describe("getPetById", () => {
  beforeEach(async () => {
    await signInAsAdmin();
  });

  it("returns an active animal", async () => {
    await insertServerPet(makeCatalogPet({ id: "pet-catalog-active" }), TEST_ADMIN_ACTOR);

    expect(await getPetById("pet-catalog-active")).toMatchObject({ id: "pet-catalog-active" });
  });

  it("returns null for an archived animal", async () => {
    // The leak this closes: getPublicPets has filtered archived rows since it was written, but
    // the reader behind /pets/[id] did not — so archiving took an animal out of the grid while
    // leaving its public profile reachable by direct link.
    await insertServerPet(
      makeCatalogPet({ id: "pet-catalog-archived", isArchived: true }),
      TEST_ADMIN_ACTOR
    );

    expect(await getPetById("pet-catalog-archived")).toBeNull();
  });

  it("returns null for an id that does not exist", async () => {
    expect(await getPetById("pet-catalog-no-such-id")).toBeNull();
  });
});
