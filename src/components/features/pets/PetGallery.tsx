"use client";

import {
  Search,
  RotateCcw,
  Dog,
  Cat,
  SlidersHorizontal,
  X,
  Compass,
  HeartHandshake,
} from "lucide-react";
import { Pet } from "@/types/pet";
import { PetCard } from "./PetCard";
import { PetDetailDialog } from "./PetDetailDialog";
import { AdoptionForm } from "@/components/features/adoptions/AdoptionForm";
import { PetMatchQuiz } from "./PetMatchQuiz";
import { SponsorshipModal } from "./SponsorshipModal";
import { Button } from "@/components/ui/button";
import { usePetGalleryController } from "@/hooks/usePetGalleryController";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { AGE_BANDS, formatAgeBandRange } from "@/lib/domain/petAge";

/**
 * i18n keys for the lifecycle band names. The year range printed beside each name is derived
 * from `AGE_BAND_MIN_MONTHS`, not written here — hand-written ranges drifted from the maths and
 * left both 3 and 7 claimed by two filter options at once (PS-114).
 */
const AGE_BAND_LABEL_KEYS: Record<(typeof AGE_BANDS)[number], string> = {
  puppy_kitten: "pets.puppyKitten",
  young: "pets.young",
  adult: "pets.adult",
  senior: "pets.senior",
};

interface PetGalleryProps {
  initialPets?: Pet[];
  featuredOnly?: boolean;
  title?: string;
  subtitle?: string;
  showFilters?: boolean;
  syncUrl?: boolean;
}

export function PetGallery({
  initialPets,
  featuredOnly = false,
  title,
  subtitle,
  showFilters = true,
  syncUrl = true,
}: PetGalleryProps) {
  const { t, isMs } = useLanguage();
  const { state, handlers } = usePetGalleryController({ initialPets, featuredOnly, syncUrl });
  const {
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
  } = state;
  const {
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
    setActivePetForAdoption,
  } = handlers;

  const displayTitle = title || t("pets.title", "Adoptable Animals in Selangor");
  const displaySubtitle = subtitle || t("pets.subtitle", "Browse rescued dogs, cats, puppies, and kittens awaiting their forever homes in Petaling Jaya.");

  return (
    <section className="w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 mb-6">
        <div>
          <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {displayTitle}
          </h2>
          {displaySubtitle && (
            <p className="text-base text-muted-foreground mt-1">
              {displaySubtitle}
            </p>
          )}
        </div>

        {/* Actions & Pet Counter */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsQuizOpen(true)}
            className="text-xs font-bold gap-1.5 text-foreground cursor-pointer"
          >
            <Compass className="size-3.5" />
            {t("nav.matchQuiz", "Compatibility Quiz")}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => handleOpenSponsor()}
            className="text-xs font-bold gap-1.5 cursor-pointer"
          >
            <HeartHandshake className="size-3.5" />
            {t("common.sponsor", "Sponsor")}
          </Button>

          <div className="text-xs font-mono text-muted-foreground font-semibold px-2 py-1 bg-muted rounded-md">
            {filteredPets.length} / {pets.length} {isMs ? "haiwan" : "animals"}
          </div>
        </div>
      </div>

      {/* Filter Controls Bar */}
      {showFilters && (
        <div className="mb-8 space-y-4 border border-border bg-card p-4 sm:p-6 rounded-2xl">
          
          {/* Top Bar: Search & Species Toggle */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-center">
            {/* Search Input */}
            <div className="lg:col-span-8 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4.5 text-muted-foreground" aria-hidden="true" />
              <input
                type="text"
                placeholder={t("common.searchPlaceholder", "Search by name, breed, or personality tag...")}
                value={searchQuery}
                aria-label={t("common.search", "Search adoptable pets")}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-background border border-input pl-11 pr-10 py-2.5 text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-foreground focus:border-transparent rounded-xl"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1.5 focus-visible:ring-2 cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            {/* Species Toggle */}
            <div className="lg:col-span-4 flex items-center justify-between sm:justify-end gap-2.5">
              <div className="flex border border-border bg-muted/50 p-1 w-full sm:w-auto rounded-xl" role="group" aria-label="Filter by species">
                <button
                  type="button"
                  onClick={() => setSelectedSpecies("all")}
                  className={`flex-1 sm:flex-none px-4 py-2 text-sm font-bold uppercase tracking-wider transition-colors focus-visible:ring-2 rounded-lg cursor-pointer ${
                    selectedSpecies === "all"
                      ? "bg-foreground text-background shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t("common.all", "All")}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSpecies("dog")}
                  className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-bold uppercase tracking-wider transition-colors focus-visible:ring-2 rounded-lg cursor-pointer ${
                    selectedSpecies === "dog"
                      ? "bg-foreground text-background shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Dog className="size-4" aria-hidden="true" />
                  {t("common.dogs", "Dogs")}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSpecies("cat")}
                  className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-bold uppercase tracking-wider transition-colors focus-visible:ring-2 rounded-lg cursor-pointer ${
                    selectedSpecies === "cat"
                      ? "bg-foreground text-background shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Cat className="size-4" aria-hidden="true" />
                  {t("common.cats", "Cats")}
                </button>
              </div>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilters}
                  className="text-sm font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <RotateCcw className="size-3.5 mr-1" aria-hidden="true" />
                  {t("common.resetFilters", "Reset")}
                </Button>
              )}
            </div>
          </div>

          {/* Secondary Dropdown Selects */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5 pt-3 border-t border-border/60">
            <div>
              <label htmlFor="filter-age" className="text-xs sm:text-sm font-semibold text-foreground block mb-1">
                {t("pets.ageFilter", "Age Group")}
              </label>
              <select
                id="filter-age"
                value={selectedAge}
                onChange={(e) => setSelectedAge(e.target.value)}
                className="w-full bg-background border border-input px-3 py-2 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-foreground font-medium rounded-lg"
              >
                <option value="all">{isMs ? "Semua Umur" : "All Ages"}</option>
                {AGE_BANDS.map((band) => (
                  <option key={band} value={band}>
                    {`${t(AGE_BAND_LABEL_KEYS[band])} (${formatAgeBandRange(band, isMs ? "ms" : "en")})`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="filter-size" className="text-xs sm:text-sm font-semibold text-foreground block mb-1">
                {t("pets.sizeFilter", "Size")}
              </label>
              <select
                id="filter-size"
                value={selectedSize}
                onChange={(e) => setSelectedSize(e.target.value)}
                className="w-full bg-background border border-input px-3 py-2 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-foreground font-medium rounded-lg"
              >
                <option value="all">{isMs ? "Semua Saiz" : "All Sizes"}</option>
                <option value="Small">{isMs ? "Kecil (< 10 kg)" : "Small (< 10 kg)"}</option>
                <option value="Medium">{isMs ? "Sederhana (10 – 25 kg)" : "Medium (10 – 25 kg)"}</option>
                <option value="Large">{isMs ? "Besar (25+ kg)" : "Large (25+ kg)"}</option>
              </select>
            </div>

            <div>
              <label htmlFor="filter-status" className="text-xs sm:text-sm font-semibold text-foreground block mb-1">
                {t("pets.statusFilter", "Status")}
              </label>
              <select
                id="filter-status"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full bg-background border border-input px-3 py-2 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-foreground font-medium rounded-lg"
              >
                <option value="all">{isMs ? "Semua Status" : "All Statuses"}</option>
                <option value="Available">{isMs ? "Tersedia untuk Adopsi" : "Available for Adoption"}</option>
                <option value="In Rehabilitation">{isMs ? "Dalam Pemulihan" : "In Rehabilitation"}</option>
                <option value="Pending">{isMs ? "Sedang Diproses" : "Application Pending"}</option>
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
                className="w-full text-sm font-semibold py-2 focus-visible:ring-2 cursor-pointer"
              >
                {t("common.apply", "Adoption Form")}
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
              onSponsorPet={handleOpenSponsor}
            />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="text-center py-12 border border-border bg-muted/20 p-8 space-y-3 rounded-2xl">
          <div className="mx-auto flex size-12 items-center justify-center bg-muted text-muted-foreground rounded-full">
            <SlidersHorizontal className="size-6" />
          </div>
          <h3 className="font-heading text-xl font-bold text-foreground">
            {t("pets.noResultsTitle", "No animals match your search filters")}
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
            {t("pets.noResultsDesc", "Try adjusting your filter criteria or clear all filters to see all adoptable rescues.")}
          </p>
          <Button onClick={handleResetFilters} variant="outline" size="sm" className="text-sm font-semibold cursor-pointer">
            {t("common.resetFilters", "Reset Filters")}
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
