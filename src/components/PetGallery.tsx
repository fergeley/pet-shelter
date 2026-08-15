"use client";

import React, { useState, useMemo } from "react";
import { Search, RotateCcw, Dog, Cat, SlidersHorizontal, X } from "lucide-react";
import { Pet } from "@/types/pet";
import defaultPetsData from "@/data/pets.json";
import { PetCard } from "@/components/PetCard";
import { PetDetailDialog } from "@/components/PetDetailDialog";
import { AdoptionForm } from "@/components/AdoptionForm";
import { PetMatchQuiz } from "@/components/PetMatchQuiz";
import { SponsorshipModal } from "@/components/SponsorshipModal";
import { Button } from "@/components/ui/button";
import { usePetStore } from "@/lib/petStore";
import { Sparkles, HeartHandshake } from "lucide-react";

interface PetGalleryProps {
  initialPets?: Pet[];
  featuredOnly?: boolean;
  title?: string;
  subtitle?: string;
  showFilters?: boolean;
}

export function PetGallery({
  initialPets,
  featuredOnly = false,
  title = "Available Pets",
  subtitle,
  showFilters = true,
}: PetGalleryProps) {
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

  return (
    <section className="w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 mb-6">
        <div>
          <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {title}
          </h2>
          {subtitle && (
            <p className="text-base text-muted-foreground mt-1">
              {subtitle}
            </p>
          )}
        </div>

        {/* Actions & Pet Counter */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsQuizOpen(true)}
            className="text-xs font-bold gap-1.5 border-primary/40 bg-primary/5 hover:bg-primary/10 text-foreground"
          >
            <Sparkles className="size-3.5 text-primary" />
            Find Your Match (Quiz)
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setActivePetForSponsorship(null);
              setIsSponsorshipOpen(true);
            }}
            className="text-xs font-bold gap-1.5"
          >
            <HeartHandshake className="size-3.5" />
            Sponsor
          </Button>

          <div className="text-xs font-mono text-muted-foreground font-semibold px-2 py-1 bg-muted">
            {filteredPets.length} of {pets.length} animals
          </div>
        </div>
      </div>

      {/* Filter Controls Bar */}
      {showFilters && (
        <div className="mb-8 space-y-4 border border-border bg-card p-4 sm:p-6">
          
          {/* Top Bar: Search & Species Toggle */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-center">
            {/* Search Input */}
            <div className="lg:col-span-8 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4.5 text-muted-foreground" aria-hidden="true" />
              <input
                type="text"
                placeholder="Search by name, breed, or trait (e.g. 'Labrador', 'Kitten', 'House-Trained')..."
                value={searchQuery}
                aria-label="Search adoptable pets"
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-background border border-input pl-11 pr-10 py-2.5 text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-foreground focus:border-transparent"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1.5 focus-visible:ring-2"
                  aria-label="Clear search"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            {/* Species Toggle */}
            <div className="lg:col-span-4 flex items-center justify-between sm:justify-end gap-2.5">
              <div className="flex border border-border bg-muted/50 p-1 w-full sm:w-auto" role="group" aria-label="Filter by species">
                <button
                  type="button"
                  onClick={() => setSelectedSpecies("all")}
                  className={`flex-1 sm:flex-none px-4 py-2 text-sm font-bold uppercase tracking-wider transition-colors focus-visible:ring-2 ${
                    selectedSpecies === "all"
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSpecies("dog")}
                  className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-bold uppercase tracking-wider transition-colors focus-visible:ring-2 ${
                    selectedSpecies === "dog"
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Dog className="size-4" aria-hidden="true" />
                  Dogs
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSpecies("cat")}
                  className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-bold uppercase tracking-wider transition-colors focus-visible:ring-2 ${
                    selectedSpecies === "cat"
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Cat className="size-4" aria-hidden="true" />
                  Cats
                </button>
              </div>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilters}
                  className="text-sm font-semibold text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="size-3.5 mr-1" aria-hidden="true" />
                  Reset
                </Button>
              )}
            </div>
          </div>

          {/* Secondary Dropdown Selects */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5 pt-3 border-t border-border/60">
            <div>
              <label htmlFor="filter-age" className="text-xs sm:text-sm font-semibold text-foreground block mb-1">
                Age Stage
              </label>
              <select
                id="filter-age"
                value={selectedAge}
                onChange={(e) => setSelectedAge(e.target.value)}
                className="w-full bg-background border border-input px-3 py-2 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-foreground font-medium"
              >
                <option value="all">All Ages</option>
                <option value="puppy_kitten">Puppy / Kitten (&lt; 1 yr)</option>
                <option value="young">Young (1 – 3 yrs)</option>
                <option value="adult">Adult (3 – 7 yrs)</option>
                <option value="senior">Senior (7+ yrs)</option>
              </select>
            </div>

            <div>
              <label htmlFor="filter-size" className="text-xs sm:text-sm font-semibold text-foreground block mb-1">
                Size
              </label>
              <select
                id="filter-size"
                value={selectedSize}
                onChange={(e) => setSelectedSize(e.target.value)}
                className="w-full bg-background border border-input px-3 py-2 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-foreground font-medium"
              >
                <option value="all">All Sizes</option>
                <option value="Small">Small (&lt; 10 kg)</option>
                <option value="Medium">Medium (10 – 25 kg)</option>
                <option value="Large">Large (25+ kg)</option>
              </select>
            </div>

            <div>
              <label htmlFor="filter-status" className="text-xs sm:text-sm font-semibold text-foreground block mb-1">
                Status
              </label>
              <select
                id="filter-status"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full bg-background border border-input px-3 py-2 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-foreground font-medium"
              >
                <option value="all">All Statuses</option>
                <option value="Available">Available for Adoption</option>
                <option value="Pending">Application Pending</option>
              </select>
            </div>

            <div className="col-span-2 sm:col-span-3 md:col-span-1 flex items-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActivePetForAdoption(filteredPets[0] || pets[0]);
                  setIsAdoptionOpen(true);
                }}
                className="w-full text-sm font-semibold py-2 focus-visible:ring-2"
              >
                Adoption Form
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Grid */}
      {filteredPets.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
          {filteredPets.map((pet) => (
            <PetCard
              key={pet.id}
              pet={pet}
              onSelectPet={handleOpenDetail}
              onAdoptPet={handleOpenAdoption}
            />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="text-center py-12 border border-border bg-muted/20 p-8 space-y-3">
          <div className="mx-auto flex size-12 items-center justify-center bg-muted text-muted-foreground">
            <SlidersHorizontal className="size-6" />
          </div>
          <h3 className="font-heading text-xl font-bold text-foreground">
            No pets match your criteria
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
            Try adjusting your search terms or resetting filters to view all available animals.
          </p>
          <Button onClick={handleResetFilters} variant="outline" size="sm" className="text-sm font-semibold">
            Reset Filters
          </Button>
        </div>
      )}

      {/* Pet Detail Profile Modal */}
      <PetDetailDialog
        pet={activePetForDetail}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onStartAdoption={handleOpenAdoption}
      />

      {/* Adoption Application Form Modal */}
      <AdoptionForm
        selectedPet={activePetForAdoption}
        allPets={pets}
        open={isAdoptionOpen}
        onOpenChange={setIsAdoptionOpen}
      />

      {/* Pet Match Quiz Modal */}
      <PetMatchQuiz
        open={isQuizOpen}
        onOpenChange={setIsQuizOpen}
        onSelectPet={handleOpenDetail}
        onApplyForPet={handleOpenAdoption}
      />

      {/* Rescue Sponsorship Modal */}
      <SponsorshipModal
        open={isSponsorshipOpen}
        onOpenChange={setIsSponsorshipOpen}
        targetPet={activePetForSponsorship}
      />
    </section>
  );
}
