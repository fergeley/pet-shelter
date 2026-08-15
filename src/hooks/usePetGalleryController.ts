"use client";

import { useState, useMemo } from "react";
import { Pet } from "@/types/pet";
import { usePetStore } from "@/lib/petStore";

export interface UsePetGalleryControllerProps {
  initialPets?: Pet[];
  featuredOnly?: boolean;
}

export function usePetGalleryController({
  initialPets,
  featuredOnly = false,
}: UsePetGalleryControllerProps = {}) {
  const { pets: storePets } = usePetStore();
  const pets = initialPets || storePets;

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpecies, setSelectedSpecies] = useState<string>("all");
  const [selectedAge, setSelectedAge] = useState<string>("all");
  const [selectedSize, setSelectedSize] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

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

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedSpecies("all");
    setSelectedAge("all");
    setSelectedSize("all");
    setSelectedStatus("all");
  };

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
