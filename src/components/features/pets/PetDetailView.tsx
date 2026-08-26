"use client";

import Image from "next/image";
import Link from "next/link";
import { Pet } from "@/types/pet";
import { AdoptionForm } from "@/components/features/adoptions/AdoptionForm";
import { SponsorshipModal } from "./SponsorshipModal";
import { MedicalTimeline } from "./MedicalTimeline";
import { Button, buttonVariants } from "@/components/ui/button";
import { useLanguage } from "@/components/providers/LanguageProvider";
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
  Star,
  MapPin,
  CalendarDays,
} from "lucide-react";
import { getRehabStageLabel, getRehabProgressPercent } from "@/lib/petStatusPresentation";
import { PetStatusIcon } from "./PetStatusIcon";

import { usePetDetailViewController } from "@/hooks/usePetDetailViewController";

interface PetDetailViewProps {
  initialPet: Pet;
}

export function PetDetailView(props: PetDetailViewProps) {
  const { t, isMs } = useLanguage();
  const { state, handlers } = usePetDetailViewController(props);
  const { pet, pets, isAvailable, statusPresentation, isAdoptionOpen, isSponsorshipOpen, copiedLink, waUrl } = state;
  const { setIsAdoptionOpen, setIsSponsorshipOpen, handleShare } = handlers;

  const isInRehabilitation = statusPresentation.isInRehabilitation;
  const rehabStage = isInRehabilitation ? getRehabStageLabel(pet, isMs) : undefined;
  const rehabProgress = isInRehabilitation ? getRehabProgressPercent(pet) : undefined;
  // Newest first, and never mutate the array the store handed us.
  const updates = [...(pet.updates ?? [])].sort((a, b) => b.date.localeCompare(a.date));

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
            {t("common.backToAllPets", "Back to All Pets")}
          </Link>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              className="text-xs gap-1.5 h-8 px-3 cursor-pointer"
            >
              {copiedLink ? <CheckCircle2 className="size-3.5 text-emerald-600" /> : <Share2 className="size-3.5" />}
              {copiedLink ? t("common.linkCopied", "Link Copied!") : t("common.sharePet", "Share Pet")}
            </Button>
          </div>
        </div>
      </div>

      <div className="w-full px-6 sm:px-8 lg:px-12 pt-8 sm:pt-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 max-w-7xl mx-auto">
          
          {/* Left: Pet Photography & Location */}
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
                  className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white ${statusPresentation.badgeClass}`}
                >
                  <PetStatusIcon tone={statusPresentation.tone} className="size-3.5" />
                  {t(statusPresentation.labelKey, statusPresentation.labelFallback)}
                </span>
                {pet.featured && (
                  <span className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider bg-amber-600 text-white flex items-center gap-1">
                    <Star className="size-3 fill-current" /> {isMs ? "Pilihan Utama" : "Featured"}
                  </span>
                )}
              </div>
              <div className="absolute bottom-4 right-4 bg-black/85 px-3 py-1 text-xs font-semibold text-white">
                {pet.gender === "Male" ? t("common.male", "Male") : t("common.female", "Female")} • {pet.age}
              </div>
            </div>

            {/* Quick Location & Visiting Note */}
            <div className="border border-border bg-muted/30 p-4 text-xs space-y-1.5 rounded-xl">
              <div className="font-bold text-foreground flex items-center gap-1.5">
                <MapPin className="size-3.5 text-primary" />
                {t("petDetail.sanctuaryLocationHours", "Sanctuary Location & Visiting Hours")}
              </div>
              <p className="text-muted-foreground">
                {t("petDetail.sanctuaryAddress", "No. 18, Jalan SS 2/72, 47300 Petaling Jaya, Selangor • Open Tue–Sun: 10:00 AM – 5:00 PM")}
              </p>
            </div>

            {/* Interactive Chronological Medical Care Timeline */}
            <div className="border border-border bg-card p-5 sm:p-6 rounded-2xl shadow-xs space-y-3">
              <MedicalTimeline pet={pet} compact={false} />
            </div>

            {/* Caregiver progress updates — newest first. Rendered whenever updates exist,
                not only during rehabilitation, so an adopted animal keeps its history. */}
            {updates.length > 0 && (
              <div className="border border-border bg-card p-5 sm:p-6 rounded-2xl shadow-xs space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <CalendarDays className="size-4" />
                  {t("petDetail.updatesTitle", "Progress Updates")}
                </h2>

                <ol className="space-y-4">
                  {updates.map((update) => (
                    <li
                      key={update.id}
                      className="border-l-2 border-indigo-700/40 pl-4 space-y-1"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <time
                          dateTime={update.date}
                          className="font-mono text-[11px] font-semibold text-muted-foreground"
                        >
                          {update.date}
                        </time>
                        {update.category && (
                          <span className="bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-secondary-foreground border border-border rounded-sm">
                            {update.category}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-foreground leading-snug">
                        {(isMs && update.titleMs) || update.title}
                      </h3>
                      <p className="text-sm text-foreground/85 leading-relaxed">
                        {(isMs && update.contentMs) || update.content}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>

          {/* Right: Pet Narrative, Medical & Compatibility */}
          <div className="lg:col-span-6 space-y-6">
            <div>
              <div className="flex items-baseline justify-between gap-4">
                <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
                  {pet.name}
                </h1>
                {!isInRehabilitation ? (
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                      {t("petDetail.adoptionFee", "Adoption Fee")}
                    </span>
                    <span className="font-heading text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                      {pet.adoptionFee.toLowerCase().includes("free")
                        ? isMs
                          ? "Percuma (RM 0)"
                          : "Free (RM 0)"
                        : pet.adoptionFee}
                    </span>
                  </div>
                ) : (
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">
                      {t("petDetail.careProgram", isMs ? "Program Rawatan" : "Care Program")}
                    </span>
                    <span className="font-heading text-lg font-bold text-indigo-700 dark:text-indigo-300">
                      {t("petDetail.sponsorSupported", isMs ? "Perlu Penajaan" : "Sponsor Supported")}
                    </span>
                  </div>
                )}
              </div>
              <p className="text-base text-muted-foreground mt-1">
                {pet.breed} • <span className="font-mono font-medium">{pet.weight}</span> • {t("petDetail.intakeDate", "Rescue Intake Date")}: {pet.intakeDate}
              </p>
            </div>

            {/* Characteristic Tags */}
            <div className="flex flex-wrap gap-1.5">
              {pet.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground border border-border rounded-md"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Rehabilitation status — an animal under care is not adoptable, so the page
                leads with treatment stage and recovery progress instead of an adoption CTA. */}
            {isInRehabilitation && (
              <div className="border border-indigo-700/30 bg-indigo-500/5 p-4 space-y-3 rounded-xl">
                <div className="flex items-start gap-2">
                  <PetStatusIcon tone={statusPresentation.tone} className="size-5 shrink-0 text-indigo-800 dark:text-indigo-300" />
                  <div className="min-w-0 space-y-1">
                    <span
                      className={`inline-block px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white rounded-sm ${statusPresentation.badgeClass}`}
                    >
                      {t(statusPresentation.labelKey, statusPresentation.labelFallback)}
                    </span>
                    {rehabStage && (
                      <p className="font-heading text-lg font-bold text-foreground leading-snug">
                        {rehabStage}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {t(
                        "petDetail.underCareNotice",
                        "Under veterinary care — not yet available for adoption. Sponsorship funds this animal's treatment."
                      )}
                    </p>
                  </div>
                </div>

                {rehabProgress !== undefined && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-semibold">
                      <span className="uppercase tracking-wider text-muted-foreground">
                        {t("common.rehabProgress", "Recovery Progress")}
                      </span>
                      <span className="font-mono text-foreground">{rehabProgress}%</span>
                    </div>
                    <div
                      className="h-2 w-full overflow-hidden bg-muted rounded-full"
                      role="progressbar"
                      aria-valuenow={rehabProgress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${pet.name} — ${t("common.rehabProgress", "Recovery Progress")}`}
                    >
                      <div
                        className="h-full bg-indigo-700 dark:bg-indigo-500 transition-all duration-300"
                        style={{ width: `${rehabProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action Bar (Apply, WhatsApp, Sponsor). Rehabilitating animals cannot be adopted
                out directly, so the adoption call to action is omitted rather than shown dead —
                the status panel above already explains why, and sponsorship is the live path. */}
            <div
              className={`grid grid-cols-1 gap-3 border-y border-border py-4 ${
                isInRehabilitation ? "sm:grid-cols-2" : "sm:grid-cols-3"
              }`}
            >
              {!isInRehabilitation && (
                <Button
                  disabled={!isAvailable}
                  onClick={() => setIsAdoptionOpen(true)}
                  className="w-full text-xs sm:text-sm font-bold uppercase tracking-wider gap-1.5 py-3 cursor-pointer"
                >
                  <Heart className="size-4 fill-current" />
                  {isAvailable
                    ? t("petDetail.applyToAdopt", "Apply to Adopt")
                    : t("petDetail.adoptionPending", "Adoption Pending")}
                </Button>
              )}

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
                {t("petDetail.whatsAppUs", "WhatsApp Us")}
              </a>

              <Button
                variant="outline"
                onClick={() => setIsSponsorshipOpen(true)}
                className="w-full text-xs font-bold gap-1.5 py-3 cursor-pointer"
              >
                <HeartHandshake className="size-4" />
                {t("petDetail.sponsorCare", "Sponsor Care")}
              </Button>
            </div>

            {/* Rescue Story */}
            <div className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                {t("petDetail.rescueNarrative", "Rescue Narrative & Background")}
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
                <ShieldCheck className="size-4 text-emerald-700 dark:text-emerald-400" />
                {t("petDetail.vetClearanceTitle", "Veterinary Clearance & Medical Status")}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="border border-border bg-background p-3 flex items-center gap-2 rounded-xl">
                  <div className={`p-1 border rounded-md ${pet.medical.vaccinated ? "border-emerald-700 bg-emerald-800/10 text-emerald-700 dark:text-emerald-400" : "border-destructive text-destructive"}`}>
                    {pet.medical.vaccinated ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                  </div>
                  <div>
                    <div className="font-bold text-foreground">{t("petDetail.vaccinatedTitle", "Core Vaccinated")}</div>
                    <div className="text-[10px] text-muted-foreground">{t("petDetail.vaccinatedSub", "DHPPi / FVRCP series")}</div>
                  </div>
                </div>

                <div className="border border-border bg-background p-3 flex items-center gap-2 rounded-xl">
                  <div className={`p-1 border rounded-md ${pet.medical.spayedNeutered ? "border-emerald-700 bg-emerald-800/10 text-emerald-700 dark:text-emerald-400" : "border-destructive text-destructive"}`}>
                    {pet.medical.spayedNeutered ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                  </div>
                  <div>
                    <div className="font-bold text-foreground">{t("petDetail.spayedTitle", "Spayed / Neutered")}</div>
                    <div className="text-[10px] text-muted-foreground">{t("petDetail.spayedSub", "Certified sterile")}</div>
                  </div>
                </div>

                <div className="border border-border bg-background p-3 flex items-center gap-2 rounded-xl">
                  <div className={`p-1 border rounded-md ${pet.medical.microchipped ? "border-emerald-700 bg-emerald-800/10 text-emerald-700 dark:text-emerald-400" : "border-destructive text-destructive"}`}>
                    {pet.medical.microchipped ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                  </div>
                  <div>
                    <div className="font-bold text-foreground">{t("petDetail.chippedTitle", "Microchipped")}</div>
                    <div className="text-[10px] text-muted-foreground">{t("petDetail.chippedSub", "Registered ISO ID")}</div>
                  </div>
                </div>
              </div>

              {pet.medical.specialNeeds && (
                <div className="bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-900 dark:text-amber-300 rounded-xl">
                  <strong>{t("petDetail.specialCareTitle", "Special Care Note")}: </strong> {pet.medical.specialNeeds}
                </div>
              )}
            </div>

            {/* Compatibility Matrix */}
            <div className="space-y-2.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                {t("petDetail.compatibilityTitle", "Household Compatibility & Temperament")}
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                <div className="border border-border bg-background p-3 rounded-xl">
                  <Dog className="size-4 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-[10px] font-semibold uppercase text-muted-foreground">{t("petDetail.goodWithDogs", "Dogs")}</div>
                  <div className={`text-xs font-bold mt-0.5 ${pet.compatibility.goodWithDogs ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"}`}>
                    {pet.compatibility.goodWithDogs ? t("petDetail.good", "Good") : t("petDetail.noDogs", "No Dogs")}
                  </div>
                </div>

                <div className="border border-border bg-background p-3 rounded-xl">
                  <Cat className="size-4 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-[10px] font-semibold uppercase text-muted-foreground">{t("petDetail.goodWithCats", "Cats")}</div>
                  <div className={`text-xs font-bold mt-0.5 ${pet.compatibility.goodWithCats ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"}`}>
                    {pet.compatibility.goodWithCats ? t("petDetail.good", "Good") : t("petDetail.noCats", "No Cats")}
                  </div>
                </div>

                <div className="border border-border bg-background p-3 rounded-xl">
                  <Baby className="size-4 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-[10px] font-semibold uppercase text-muted-foreground">{t("petDetail.goodWithKids", "Children")}</div>
                  <div className={`text-xs font-bold mt-0.5 ${pet.compatibility.goodWithKids ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"}`}>
                    {pet.compatibility.goodWithKids ? t("petDetail.kidSafe", "Kid-Safe") : t("petDetail.adultsOnly", "Adults Only")}
                  </div>
                </div>

                <div className="border border-border bg-background p-3 rounded-xl">
                  <Activity className="size-4 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-[10px] font-semibold uppercase text-muted-foreground">{t("petDetail.energyLevel", "Energy")}</div>
                  <div className="text-xs font-bold text-foreground mt-0.5">
                    {pet.compatibility.energyLevel === "Low" ? t("common.low", "Low") : pet.compatibility.energyLevel === "High" ? t("common.high", "High") : t("common.moderate", "Moderate")}
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
