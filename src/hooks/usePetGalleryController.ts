"use client";

import { useState, useMemo, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Pet } from "@/types/pet";
import { usePetStore } from "@/lib/client/petStore";
import {
  buildPetTrackOptions,
  buildPopulatedStatusFilterOptions,
  matchesStatusFilter,
  matchesTrackFilter,
} from "@/lib/presentation/petStatusPresentation";

/**
 * Every filter the gallery offers, keyed by the URL parameter it round-trips through, with the
 * value that means "not filtering".
 *
 * This used to be five parallel copies of the same four-part pattern — a `useState`, a
 * `searchParams.get` fallback, a branch inside `updateUrlParams`, and a `useCallback` setter —
 * one set per filter. Adding gender and track by that method would have made seven, and the
 * fifth copy is already four past the point where AGENTS.md says to abstract. Now a filter is
 * one line here plus, if it is not a plain equality, one line in `BASE_MATCHERS`.
 */
const FILTER_DEFAULTS = {
  search: "",
  species: "all",
  gender: "all",
  ageCategory: "all",
  size: "all",
  status: "all",
  track: "all",
} as const;

export type PetFilterKey = keyof typeof FILTER_DEFAULTS;

type FilterValues = Record<PetFilterKey, string>;

const FILTER_KEYS = Object.keys(FILTER_DEFAULTS) as PetFilterKey[];

/**
 * The filters that narrow the population independently of one another.
 *
 * `track` and `status` are deliberately absent: they are staged rather than parallel — status is
 * scoped *within* the selected track — so they are applied below in that order instead of being
 * folded in here.
 */
const BASE_MATCHERS: Record<
  "search" | "species" | "gender" | "ageCategory" | "size",
  (pet: Pet, value: string) => boolean
> = {
  search: (pet, value) => {
    const query = value.trim().toLowerCase();
    if (query === "") return true;
    return (
      pet.name.toLowerCase().includes(query) ||
      pet.breed.toLowerCase().includes(query) ||
      pet.description.toLowerCase().includes(query) ||
      pet.tags.some((tag) => tag.toLowerCase().includes(query))
    );
  },
  species: (pet, value) => pet.species === value,
  gender: (pet, value) => pet.gender === value,
  ageCategory: (pet, value) => pet.ageCategory === value,
  size: (pet, value) => pet.size === value,
};

const BASE_MATCHER_KEYS = Object.keys(BASE_MATCHERS) as (keyof typeof BASE_MATCHERS)[];

export interface UsePetGalleryControllerProps {
  initialPets?: Pet[];
  featuredOnly?: boolean;
  syncUrl?: boolean;
}

export function usePetGalleryController({
  initialPets,
  featuredOnly = false,
  syncUrl = true,
}: UsePetGalleryControllerProps = {}) {
  const { pets: storePets } = usePetStore();
  const pets = initialPets || storePets;

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const readFromUrl = useCallback(
    (key: PetFilterKey) => searchParams?.get(key) || FILTER_DEFAULTS[key],
    [searchParams]
  );

  // Used only when `syncUrl` is false — the home page mounts this gallery without wanting the
  // address bar to change under the visitor.
  const [localFilters, setLocalFilters] = useState<FilterValues>(() => ({
    ...FILTER_DEFAULTS,
    ...Object.fromEntries(FILTER_KEYS.map((key) => [key, searchParams?.get(key) || FILTER_DEFAULTS[key]])),
  }));

  const filters: FilterValues = useMemo(() => {
    if (!syncUrl) return localFilters;
    return Object.fromEntries(FILTER_KEYS.map((key) => [key, readFromUrl(key)])) as FilterValues;
  }, [syncUrl, localFilters, readFromUrl]);

  /**
   * Apply any number of filter changes at once.
   *
   * Taking a partial record rather than one key is what lets "switching track also clears the
   * status" be a single history entry. With a setter per filter it would have been two
   * `router.replace` calls in the same tick, the second built from a `searchParams` snapshot
   * that predates the first — so one of the two changes would be dropped.
   */
  const updateFilters = useCallback(
    (updates: Partial<FilterValues>) => {
      if (!syncUrl) {
        setLocalFilters((current) => ({ ...current, ...updates }));
        return;
      }
      if (!router || !pathname) return;

      const params = new URLSearchParams(searchParams ? searchParams.toString() : "");
      for (const [key, rawValue] of Object.entries(updates) as [PetFilterKey, string][]) {
        const value = key === "search" ? rawValue.trim() : rawValue;
        if (value === FILTER_DEFAULTS[key]) params.delete(key);
        else params.set(key, value);
      }

      const queryString = params.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    },
    [syncUrl, router, pathname, searchParams]
  );

  const setFilter = useCallback(
    (key: PetFilterKey, value: string) => updateFilters({ [key]: value }),
    [updateFilters]
  );

  // Named setters kept so the component reads as prose. They are aliases over `setFilter`, not
  // seven more copies of it.
  const setSearchQuery = useCallback((value: string) => setFilter("search", value), [setFilter]);
  const setSelectedSpecies = useCallback((value: string) => setFilter("species", value), [setFilter]);
  const setSelectedGender = useCallback((value: string) => setFilter("gender", value), [setFilter]);
  const setSelectedAge = useCallback((value: string) => setFilter("ageCategory", value), [setFilter]);
  const setSelectedSize = useCallback((value: string) => setFilter("size", value), [setFilter]);
  const setSelectedStatus = useCallback((value: string) => setFilter("status", value), [setFilter]);

  /**
   * Changing track resets the status filter, because status options are scoped to the track:
   * "Pending" exists under Adoptable and nowhere else, so carrying it across would land the
   * visitor on an empty grid with no visible cause.
   */
  const setSelectedTrack = useCallback(
    (value: string) => updateFilters({ track: value, status: FILTER_DEFAULTS.status }),
    [updateFilters]
  );

  // Modal Dialog States
  const [activePetForDetail, setActivePetForDetail] = useState<Pet | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const [activePetForAdoption, setActivePetForAdoption] = useState<Pet | null>(null);
  const [isAdoptionOpen, setIsAdoptionOpen] = useState(false);

  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [isSponsorshipOpen, setIsSponsorshipOpen] = useState(false);
  const [activePetForSponsorship, setActivePetForSponsorship] = useState<Pet | null>(null);

  /**
   * Everything the independent filters accept. Track and status are applied after this, so the
   * tab strip built from it counts animals under the *other* active filters — searching "Luna"
   * shows which tracks Luna is in, rather than which tracks the shelter has.
   */
  const baseFilteredPets = useMemo(() => {
    return pets.filter((pet) => {
      // Archived animals are staff-only. The server actions filter them too; this is the client
      // store's copy of that rule, not a substitute for it.
      if (pet.isArchived) return false;
      if (featuredOnly && !pet.featured) return false;

      return BASE_MATCHER_KEYS.every((key) => {
        const value = filters[key];
        if (value === FILTER_DEFAULTS[key]) return true;
        return BASE_MATCHERS[key](pet, value);
      });
    });
  }, [pets, featuredOnly, filters]);

  const trackOptions = useMemo(() => buildPetTrackOptions(baseFilteredPets), [baseFilteredPets]);

  const trackScopedPets = useMemo(
    () => baseFilteredPets.filter((pet) => matchesTrackFilter(pet.status, filters.track)),
    [baseFilteredPets, filters.track]
  );

  const statusOptions = useMemo(
    () => buildPopulatedStatusFilterOptions(trackScopedPets),
    [trackScopedPets]
  );

  const filteredPets = useMemo(
    // Canonical comparison, or filtering for one spelling of "In Rehabilitation" silently drops
    // animals filed under the legacy alias.
    () => trackScopedPets.filter((pet) => matchesStatusFilter(pet.status, filters.status)),
    [trackScopedPets, filters.status]
  );

  const hasActiveFilters = FILTER_KEYS.some((key) => filters[key] !== FILTER_DEFAULTS[key]);

  const handleResetFilters = useCallback(() => {
    setLocalFilters({ ...FILTER_DEFAULTS });
    if (syncUrl && router && pathname) {
      router.replace(pathname, { scroll: false });
    }
  }, [syncUrl, router, pathname]);

  const handleOpenDetail = (pet: Pet) => {
    setActivePetForDetail(pet);
    setIsDetailOpen(true);
  };

  const handleOpenAdoption = (pet: Pet) => {
    setActivePetForAdoption(pet);
    setIsAdoptionOpen(true);
  };

  const handleOpenSponsor = (pet?: Pet | null) => {
    setActivePetForSponsorship(pet || null);
    setIsSponsorshipOpen(true);
  };

  return {
    state: {
      pets,
      filteredPets,
      hasActiveFilters,
      /** Track tabs and status options, both derived from the population actually on screen. */
      trackOptions,
      statusOptions,
      searchQuery: filters.search,
      selectedSpecies: filters.species,
      selectedGender: filters.gender,
      selectedAge: filters.ageCategory,
      selectedSize: filters.size,
      selectedStatus: filters.status,
      selectedTrack: filters.track,
      activePetForDetail,
      isDetailOpen,
      activePetForAdoption,
      isAdoptionOpen,
      isQuizOpen,
      isSponsorshipOpen,
      activePetForSponsorship,
    },
    handlers: {
      setSearchQuery,
      setSelectedSpecies,
      setSelectedGender,
      setSelectedAge,
      setSelectedSize,
      setSelectedStatus,
      setSelectedTrack,
      handleResetFilters,
      handleOpenDetail,
      handleOpenAdoption,
      handleOpenSponsor,
      setIsDetailOpen,
      setIsAdoptionOpen,
      setIsQuizOpen,
      setIsSponsorshipOpen,
      setActivePetForDetail,
      setActivePetForAdoption,
      setActivePetForSponsorship,
    },
  };
}
