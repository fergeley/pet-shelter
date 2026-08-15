"use client";

import Image from "next/image";
import Link from "next/link";
import { Pet } from "@/types/pet";
import { AdoptionForm } from "@/components/AdoptionForm";
import { SponsorshipModal } from "@/components/SponsorshipModal";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Heart,
  ShieldCheck,
  Check,
  X,
  Activity,
  Baby,
  Dog,
  Cat,
  Share2,
  MessageCircle,
  ArrowLeft,
  HeartHandshake,
  CheckCircle2,
  Sparkles,
  MapPin,
} from "lucide-react";

import { usePetDetailViewController } from "@/hooks/usePetDetailViewController";

interface PetDetailViewProps {
  initialPet: Pet;
}

export function PetDetailView(props: PetDetailViewProps) {
  const { state, handlers } = usePetDetailViewController(props);
  const { pet, pets, isAvailable, isAdoptionOpen, isSponsorshipOpen, copiedLink, waUrl } = state;
  const { setIsAdoptionOpen, setIsSponsorshipOpen, handleShare } = handlers;

  return (
    <div className="min-h-screen bg-card pb-20">
      {/* Top Breadcrumbs & Back */}
      <div className="border-b border-border bg-muted/20">
        <div className="w-full px-6 sm:px-8 lg:px-12 py-4 flex items-center justify-between">
          <Link
            href="/pets"
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back to All Pets
          </Link>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              className="text-xs gap-1.5 h-8 px-3"
            >
              {copiedLink ? <CheckCircle2 className="size-3.5 text-emerald-600" /> : <Share2 className="size-3.5" />}
              {copiedLink ? "Link Copied!" : "Share Pet"}
            </Button>
          </div>
        </div>
      </div>

      <div className="w-full px-6 sm:px-8 lg:px-12 pt-8 sm:pt-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 max-w-7xl mx-auto">
          
          {/* Left: Pet Photography & Gallery */}
          <div className="lg:col-span-6 space-y-4">
            <div className="relative aspect-4/3 w-full overflow-hidden border border-border bg-muted shadow-xs">
              <Image
                src={pet.image}
                alt={`${pet.name} - ${pet.breed}`}
                fill
                priority
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
              <div className="absolute top-4 left-4 flex gap-2">
                <span
                  className={`px-3 py-1 text-xs font-bold uppercase tracking-wider text-white ${
                    isAvailable ? "bg-emerald-800" : "bg-amber-800"
                  }`}
                >
                  {pet.status}
                </span>
                {pet.featured && (
                  <span className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider bg-amber-500 text-white flex items-center gap-1">
                    <Sparkles className="size-3" /> Featured
                  </span>
                )}
              </div>
              <div className="absolute bottom-4 right-4 bg-black/85 px-3 py-1 text-xs font-semibold text-white">
                {pet.gender} • {pet.age}
              </div>
            </div>

            {/* Quick Location & Visiting Note */}
            <div className="border border-border bg-muted/30 p-4 text-xs space-y-1.5">
              <div className="font-bold text-foreground flex items-center gap-1.5">
                <MapPin className="size-3.5 text-primary" />
                Sanctuary Location & Visiting Hours
              </div>
              <p className="text-muted-foreground">
                No. 18, Jalan SS 2/72, 47300 Petaling Jaya, Selangor • Open Tue–Sun: 10:00 AM – 5:00 PM
              </p>
            </div>
          </div>

          {/* Right: Pet Narrative, Medical & Compatibility */}
          <div className="lg:col-span-6 space-y-6">
            <div>
              <div className="flex items-baseline justify-between gap-4">
                <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
                  {pet.name}
                </h1>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                    Adoption Fee
                  </span>
                  <span className="font-heading text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                    {pet.adoptionFee.toLowerCase().includes("free") ? "Free (RM 0)" : pet.adoptionFee}
                  </span>
                </div>
              </div>
              <p className="text-base text-muted-foreground mt-1">
                {pet.breed} • <span className="font-mono font-medium">{pet.weight}</span> • Intake: {pet.intakeDate}
              </p>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5">
              {pet.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground border border-border"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Action Bar (Apply, WhatsApp, Sponsor) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-y border-border py-4">
              <Button
                disabled={!isAvailable}
                onClick={() => setIsAdoptionOpen(true)}
                className="w-full text-xs sm:text-sm font-bold uppercase tracking-wider gap-1.5 py-3"
              >
                <Heart className="size-4 fill-current" />
                {isAvailable ? "Apply to Adopt" : "Adoption Pending"}
              </Button>

              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({
                  variant: "outline",
                  className: "w-full text-xs font-bold gap-1.5 py-3 text-emerald-800 dark:text-emerald-300 border-emerald-700/30 hover:bg-emerald-500/10",
                })}
              >
                <MessageCircle className="size-4" />
                WhatsApp Us
              </a>

              <Button
                variant="outline"
                onClick={() => setIsSponsorshipOpen(true)}
                className="w-full text-xs font-bold gap-1.5 py-3"
              >
                <HeartHandshake className="size-4" />
                Sponsor Care
              </Button>
            </div>

            {/* Rescue Story */}
            <div className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Rescue Narrative & Background
              </h2>
              <p className="text-sm text-foreground/90 leading-relaxed">
                {pet.rescueStory}
              </p>
              <p className="text-sm text-foreground/80 leading-relaxed mt-2">
                {pet.description}
              </p>
            </div>

            {/* Medical Clearance Checklist */}
            <div className="space-y-2.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-emerald-700" />
                Veterinary Clearance & Medical Status
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="border border-border bg-background p-3 flex items-center gap-2">
                  <div className={`p-1 border ${pet.medical.vaccinated ? "border-emerald-700 bg-emerald-800/10 text-emerald-700" : "border-destructive text-destructive"}`}>
                    {pet.medical.vaccinated ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                  </div>
                  <div>
                    <div className="font-bold text-foreground">Core Vaccinated</div>
                    <div className="text-[10px] text-muted-foreground">DHPPi / FVRCP</div>
                  </div>
                </div>

                <div className="border border-border bg-background p-3 flex items-center gap-2">
                  <div className={`p-1 border ${pet.medical.spayedNeutered ? "border-emerald-700 bg-emerald-800/10 text-emerald-700" : "border-destructive text-destructive"}`}>
                    {pet.medical.spayedNeutered ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                  </div>
                  <div>
                    <div className="font-bold text-foreground">Spayed / Neutered</div>
                    <div className="text-[10px] text-muted-foreground">Certified sterile</div>
                  </div>
                </div>

                <div className="border border-border bg-background p-3 flex items-center gap-2">
                  <div className={`p-1 border ${pet.medical.microchipped ? "border-emerald-700 bg-emerald-800/10 text-emerald-700" : "border-destructive text-destructive"}`}>
                    {pet.medical.microchipped ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                  </div>
                  <div>
                    <div className="font-bold text-foreground">Microchipped</div>
                    <div className="text-[10px] text-muted-foreground">Registered ID</div>
                  </div>
                </div>
              </div>

              {pet.medical.specialNeeds && (
                <div className="bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-900 dark:text-amber-300">
                  <strong>Special Care Note: </strong> {pet.medical.specialNeeds}
                </div>
              )}
            </div>

            {/* Compatibility Matrix */}
            <div className="space-y-2.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Household Compatibility & Temperament
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                <div className="border border-border bg-background p-3">
                  <Dog className="size-4 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-[10px] font-semibold uppercase text-muted-foreground">Dogs</div>
                  <div className={`text-xs font-bold mt-0.5 ${pet.compatibility.goodWithDogs ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"}`}>
                    {pet.compatibility.goodWithDogs ? "Good" : "No Dogs"}
                  </div>
                </div>

                <div className="border border-border bg-background p-3">
                  <Cat className="size-4 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-[10px] font-semibold uppercase text-muted-foreground">Cats</div>
                  <div className={`text-xs font-bold mt-0.5 ${pet.compatibility.goodWithCats ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"}`}>
                    {pet.compatibility.goodWithCats ? "Good" : "No Cats"}
                  </div>
                </div>

                <div className="border border-border bg-background p-3">
                  <Baby className="size-4 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-[10px] font-semibold uppercase text-muted-foreground">Children</div>
                  <div className={`text-xs font-bold mt-0.5 ${pet.compatibility.goodWithKids ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"}`}>
                    {pet.compatibility.goodWithKids ? "Kid-Safe" : "Adults Only"}
                  </div>
                </div>

                <div className="border border-border bg-background p-3">
                  <Activity className="size-4 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-[10px] font-semibold uppercase text-muted-foreground">Energy</div>
                  <div className="text-xs font-bold text-foreground mt-0.5">
                    {pet.compatibility.energyLevel}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Adoption Form Modal */}
      <AdoptionForm
        open={isAdoptionOpen}
        onOpenChange={setIsAdoptionOpen}
        selectedPet={pet}
        allPets={pets}
      />

      {/* Sponsorship Modal */}
      <SponsorshipModal
        open={isSponsorshipOpen}
        onOpenChange={setIsSponsorshipOpen}
        targetPet={pet}
      />
    </div>
  );
}
