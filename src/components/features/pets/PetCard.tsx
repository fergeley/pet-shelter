"use client";

import { useState } from "react";
import Image from "next/image";
import { Info, Heart } from "lucide-react";
import { Pet } from "@/types/pet";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/providers/LanguageProvider";
import {
  getPetStatusPresentation,
  getRehabStageLabel,
  getRehabProgressPercent,
} from "@/lib/presentation/petStatusPresentation";
import { PetStatusIcon } from "./PetStatusIcon";

interface PetCardProps {
  pet: Pet;
  onSelectPet: (pet: Pet) => void;
  onAdoptPet?: (pet: Pet) => void;
  onSponsorPet?: (pet: Pet) => void;
}

const FALLBACK_PET_IMAGE = "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=800&q=80";

export function PetCard({ pet, onSelectPet, onAdoptPet, onSponsorPet }: PetCardProps) {
  const { t, isMs } = useLanguage();
  const [imgSrc, setImgSrc] = useState(pet.image || FALLBACK_PET_IMAGE);
  const status = getPetStatusPresentation(pet.status);
  const isAvailable = status.isAdoptable;
  const rehabStage = status.isInRehabilitation ? getRehabStageLabel(pet, isMs) : undefined;
  const rehabProgress = status.isInRehabilitation ? getRehabProgressPercent(pet) : undefined;

  return (
    <Card className="group flex h-full flex-col justify-between overflow-hidden border border-border bg-card transition-all duration-200 hover:border-foreground/40 hover:shadow-xs rounded-2xl">
      <div>
        {/* Pet Image Container */}
        <div className="relative aspect-4/3 w-full overflow-hidden bg-muted">
          <Image
            src={imgSrc}
            alt={`${pet.name}, ${pet.breed}`}
            fill
            onError={() => setImgSrc(FALLBACK_PET_IMAGE)}
            className="object-cover transition-transform duration-300 group-hover:scale-102"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
          
          {/* Status Badge & Free Adoption Badge - WCAG AAA Compliant */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5">
            <span
              className={`${status.badgeClass} gap-1.5 px-3 py-1 text-xs`}
            >
              <PetStatusIcon tone={status.tone} className="size-3.5" />
              {t(status.labelKey, status.labelFallback)}
            </span>
            {/* Withheld only while under care — an animal being rehomed is still a free
                adoption whether or not an application is already pending on it. */}
            {!status.isInRehabilitation && (
              <span className="bg-primary/95 text-primary-foreground font-bold px-2.5 py-1 text-xs tracking-tight rounded-sm">
                {t("common.freeAdoption", "Free Adoption")}
              </span>
            )}
          </div>

          {/* Gender & Age Pill */}
          <div className="absolute top-3 right-3 bg-black/85 px-3 py-1 text-xs font-semibold text-white">
            {pet.gender === "Male" ? t("common.male", "Male") : t("common.female", "Female")} • {pet.age}
          </div>
        </div>

        {/* Pet Name & Breed */}
        <CardHeader className="p-5 pb-2">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              {pet.name}
            </h3>
            <span className="font-mono text-sm font-semibold text-muted-foreground">
              {pet.weight}
            </span>
          </div>
          <p className="text-sm font-medium text-muted-foreground mt-0.5">
            {pet.breed}
          </p>
        </CardHeader>

        {/* Description & Characteristic Tags */}
        <CardContent className="p-5 pt-1 space-y-3">
          {/* Rehabilitation stage & recovery progress — only meaningful while under care. */}
          {rehabStage && (
            <div className="border border-care-accent/30 bg-care-surface p-3 space-y-2 rounded-lg">
              <div className="flex items-start gap-1.5">
                <PetStatusIcon tone={status.tone} className="size-3.5 mt-0.5 shrink-0 text-care-text " />
                <div className="min-w-0">
                  <p className="text-3xs font-bold uppercase tracking-wider text-care-text ">
                    {t("common.rehabStage", "Rehabilitation Stage")}
                  </p>
                  <p className="text-xs font-semibold text-foreground leading-snug mt-0.5">
                    {rehabStage}
                  </p>
                </div>
              </div>

              {rehabProgress !== undefined && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-3xs font-semibold text-muted-foreground">
                    <span>{t("common.rehabProgress", "Recovery Progress")}</span>
                    <span className="font-mono text-foreground">{rehabProgress}%</span>
                  </div>
                  <div
                    className="h-1.5 w-full overflow-hidden bg-muted rounded-full"
                    role="progressbar"
                    aria-valuenow={rehabProgress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${pet.name} — ${t("common.rehabProgress", "Recovery Progress")}`}
                  >
                    <div
                      className="h-full bg-care-accent transition-all duration-300"
                      style={{ width: `${rehabProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <p className="text-sm text-foreground/90 leading-relaxed line-clamp-2">
            {pet.description}
          </p>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {pet.tags.map((tag, idx) => (
              <span
                key={idx}
                className="bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground border border-border rounded-md"
              >
                {tag}
              </span>
            ))}
          </div>
        </CardContent>
      </div>

      {/* Footer Actions */}
      <CardFooter className="p-5 pt-0 border-t border-border/60 mt-3 grid grid-cols-2 gap-2.5">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSelectPet(pet)}
          className="w-full text-sm font-semibold py-2 focus-visible:ring-2 cursor-pointer"
        >
          <Info className="size-4 mr-1" />
          {t("common.details", "Details")}
        </Button>

        {/* An animal in rehabilitation cannot be adopted out directly, so sponsorship —
            not a dead "Pending" button — is the action offered to supporters. */}
        {status.isInRehabilitation ? (
          <Button
            size="sm"
            onClick={() => (onSponsorPet ? onSponsorPet(pet) : onSelectPet(pet))}
            className="w-full min-w-0 px-2 text-xs font-semibold py-2 focus-visible:ring-2 cursor-pointer"
          >
            {t("common.sponsorMe", "Sponsor Me")}
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={!isAvailable}
            onClick={() => {
              if (onAdoptPet) {
                onAdoptPet(pet);
              } else {
                onSelectPet(pet);
              }
            }}
            className="w-full text-sm font-semibold py-2 focus-visible:ring-2 cursor-pointer"
          >
            <Heart className="size-4 fill-current mr-1" />
            {isAvailable ? t("common.apply", "Adopt") : t(status.labelKey, status.labelFallback)}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
