"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Pet } from "@/types/pet";
import { usePetStore } from "@/lib/petStore";

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

  // Read initial filter values from URL if available
  const initialSearch = searchParams?.get("search") || "";
  const initialSpecies = searchParams?.get("species") || "all";
  const initialAge = searchParams?.get("ageCategory") || "all";
  const initialSize = searchParams?.get("size") || "all";
  const initialStatus = searchParams?.get("status") || "all";

  // Filter States
  const [searchQuery, setSearchQueryState] = useState(initialSearch);
  const [selectedSpecies, setSelectedSpeciesState] = useState<string>(initialSpecies);
  const [selectedAge, setSelectedAgeState] = useState<string>(initialAge);
  const [selectedSize, setSelectedSizeState] = useState<string>(initialSize);
  const [selectedStatus, setSelectedStatusState] = useState<string>(initialStatus);

  // Sync state if URL query params change (e.g. browser back/forward)
  useEffect(() => {
    if (!syncUrl || !searchParams) return;
    const urlSearch = searchParams.get("search") || "";
    const urlSpecies = searchParams.get("species") || "all";
    const urlAge = searchParams.get("ageCategory") || "all";
    const urlSize = searchParams.get("size") || "all";
    const urlStatus = searchParams.get("status") || "all";

    setSearchQueryState(urlSearch);
    setSelectedSpeciesState(urlSpecies);
    setSelectedAgeState(urlAge);
    setSelectedSizeState(urlSize);
    setSelectedStatusState(urlStatus);
  }, [searchParams, syncUrl]);

  // Helper to push updated params to URL
  const updateUrlParams = useCallback(
    (updates: { search?: string; species?: string; ageCategory?: string; size?: string; status?: string }) => {
      if (!syncUrl || !router || !pathname) return;

      const params = new URLSearchParams(searchParams ? searchParams.toString() : "");

      if (updates.search !== undefined) {
        if (updates.search.trim()) params.set("search", updates.search.trim());
        else params.delete("search");
      }
      if (updates.species !== undefined) {
        if (updates.species !== "all") params.set("species", updates.species);
        else params.delete("species");
      }
      if (updates.ageCategory !== undefined) {
        if (updates.ageCategory !== "all") params.set("ageCategory", updates.ageCategory);
        else params.delete("ageCategory");
      }
      if (updates.size !== undefined) {
        if (updates.size !== "all") params.set("size", updates.size);
        else params.delete("size");
      }
      if (updates.status !== undefined) {
        if (updates.status !== "all") params.set("status", updates.status);
        else params.delete("status");
      }

      const queryString = params.toString();
      const targetUrl = queryString ? `${pathname}?${queryString}` : pathname;
      router.replace(targetUrl, { scroll: false });
    },
    [syncUrl, router, pathname, searchParams]
  );

  // State setters that also update URL
  const setSearchQuery = useCallback(
    (value: string) => {
      setSearchQueryState(value);
      updateUrlParams({ search: value });
    },
    [updateUrlParams]
  );

  const setSelectedSpecies = useCallback(
    (value: string) => {
      setSelectedSpeciesState(value);
      updateUrlParams({ species: value });
    },
    [updateUrlParams]
  );

  const setSelectedAge = useCallback(
    (value: string) => {
      setSelectedAgeState(value);
      updateUrlParams({ ageCategory: value });
    },
    [updateUrlParams]
  );

  const setSelectedSize = useCallback(
    (value: string) => {
      setSelectedSizeState(value);
      updateUrlParams({ size: value });
    },
    [updateUrlParams]
  );

  const setSelectedStatus = useCallback(
    (value: string) => {
      setSelectedStatusState(value);
      updateUrlParams({ status: value });
    },
    [updateUrlParams]
  );

  // Modal Dialog States
  const [activePetForDetail, setActivePetForDetail] = useState<Pet | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const [activePetForAdoption, setActivePetForAdoption] = useState<Pet | null>(null);
  const [isAdoptionOpen, setIsAdoptionOpen] = useState(false);

  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [isSponsorshipOpen, setIsSponsorshipOpen] = useState(false);
  const [activePetForSponsorship, setActivePetForSponsorship] = useState<Pet | null>(null);

  // Filter Logic
  const filteredPets = useMemo(() => {
    return pets.filter((pet) => {
      // Exclude archived pets in public views
      if (pet.isArchived) return false;
      if (featuredOnly && !pet.featured) return false;

      // Search Query
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        const matchesName = pet.name.toLowerCase().includes(query);
        const matchesBreed = pet.breed.toLowerCase().includes(query);
        const matchesTags = pet.tags.some((t) => t.toLowerCase().includes(query));
        const matchesDesc = pet.description.toLowerCase().includes(query);
        if (!matchesName && !matchesBreed && !matchesTags && !matchesDesc) {
          return false;
        }
      }

      // Species Filter
      if (selectedSpecies !== "all" && pet.species !== selectedSpecies) {
        return false;
      }

      // Age Category Filter
      if (selectedAge !== "all" && pet.ageCategory !== selectedAge) {
        return false;
      }

      // Size Filter
      if (selectedSize !== "all" && pet.size !== selectedSize) {
        return false;
      }

      // Status Filter
      if (selectedStatus !== "all" && pet.status !== selectedStatus) {
        return false;
      }

      return true;
    });
  }, [pets, featuredOnly, searchQuery, selectedSpecies, selectedAge, selectedSize, selectedStatus]);

  const hasActiveFilters =
    searchQuery !== "" ||
    selectedSpecies !== "all" ||
    selectedAge !== "all" ||
    selectedSize !== "all" ||
    selectedStatus !== "all";

  const handleResetFilters = useCallback(() => {
    setSearchQueryState("");
    setSelectedSpeciesState("all");
    setSelectedAgeState("all");
    setSelectedSizeState("all");
    setSelectedStatusState("all");

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
      searchQuery,
      selectedSpecies,
      selectedAge,
      selectedSize,
      selectedStatus,
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
      setSelectedAge,
      setSelectedSize,
      setSelectedStatus,
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
