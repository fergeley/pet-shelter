import type { Pet } from "@/types/pet";
import { makePet } from "./render";

/**
 * A population sized to the gallery controller's derivations rather than to a screen.
 *
 * Every axis the hook filters on carries at least two distinct values, so a matcher that
 * silently matched everything (or nothing) changes the expected id list rather than leaving it
 * identical. Both spellings of rehabilitation are present because the track and status
 * derivations claim to canonicalize them — with only one spelling on hand that claim would be
 * untested, and a regression to raw string equality would still read green.
 *
 * Not a slice of `pets.json`: that file is edited by content changes, and a suite spreading it
 * would start failing for reasons that have nothing to do with this hook.
 */
export const GALLERY_PETS: Pet[] = [
  makePet({
    id: "gallery-luna",
    name: "Luna",
    species: "dog",
    gender: "Female",
    size: "Small",
    ageCategory: "puppy_kitten",
    breed: "Husky Mix",
    description: "Playful pup rescued from a Klang construction site.",
    tags: ["Playful"],
    status: "Available",
    featured: true,
  }),
  makePet({
    id: "gallery-rex",
    name: "Rex",
    species: "dog",
    gender: "Male",
    size: "Large",
    ageCategory: "adult",
    breed: "Local Mixed",
    description: "Steady guardian, an application is already under review.",
    tags: ["Calm"],
    status: "Pending",
    featured: false,
  }),
  makePet({
    id: "gallery-milo",
    name: "Milo",
    species: "cat",
    gender: "Male",
    size: "Medium",
    ageCategory: "young",
    breed: "Domestic Shorthair",
    description: "Recovering from a hind leg fracture.",
    tags: ["Gentle"],
    status: "In Rehabilitation",
    featured: true,
  }),
  makePet({
    // Stored under the legacy alias on purpose — same track and same status bucket as Milo.
    id: "gallery-nala",
    name: "Nala",
    species: "cat",
    gender: "Female",
    size: "Small",
    ageCategory: "senior",
    breed: "Domestic Longhair",
    description: "Under behavioural care with a foster.",
    tags: ["Shy"],
    status: "Rehabilitation",
    featured: false,
  }),
  makePet({
    id: "gallery-cleo",
    name: "Cleo",
    species: "dog",
    gender: "Female",
    size: "Medium",
    ageCategory: "adult",
    breed: "Beagle Mix",
    description: "Went home to a family in Subang.",
    tags: ["Alumni"],
    status: "Adopted",
    featured: false,
  }),
  makePet({
    // Featured *and* archived: the two exclusion rules have to hold independently, so an
    // archived animal that is also featured must stay off screen in both modes.
    id: "gallery-ghost",
    name: "Ghost",
    species: "dog",
    gender: "Male",
    size: "Large",
    ageCategory: "adult",
    breed: "Local Mixed",
    description: "Archived staff-only record.",
    tags: ["Archived"],
    status: "Available",
    featured: true,
    isArchived: true,
  }),
];

/** The only animal ever hidden by the archive rule, named so assertions can say why. */
export const ARCHIVED_PET_ID = "gallery-ghost";
