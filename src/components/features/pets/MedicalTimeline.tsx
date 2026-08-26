"use client";

import React, { useState, useMemo } from "react";
import { Pet, MedicalTimelineCategory } from "@/types/pet";
import { getPetMedicalTimeline, getCategoryBadgeClasses } from "@/lib/medicalTimeline";
import { useLanguage } from "@/components/providers/LanguageProvider";
import {
  ShieldCheck,
  Stethoscope,
  Syringe,
  Scissors,
  Activity,
  CheckCircle2,
  FileCheck2,
  Check,
} from "lucide-react";

interface MedicalTimelineProps {
  pet: Pet;
  compact?: boolean;
}

export function MedicalTimeline({ pet, compact = false }: MedicalTimelineProps) {
  const { language, t, isMs } = useLanguage();
  const [selectedCategory, setSelectedCategory] = useState<"all" | MedicalTimelineCategory>("all");

  const timelineEvents = useMemo(() => {
    return getPetMedicalTimeline(pet, language);
  }, [pet, language]);

  const filteredEvents = useMemo(() => {
    if (selectedCategory === "all") return timelineEvents;
    return timelineEvents.filter((e) => e.category === selectedCategory);
  }, [timelineEvents, selectedCategory]);

  const categories: { key: "all" | MedicalTimelineCategory; label: string }[] = [
    { key: "all", label: t("medicalTimeline.filterAll", "All Milestones") },
    { key: "intake", label: t("medicalTimeline.filterIntake", "Rescue Intake") },
    { key: "diagnostic", label: t("medicalTimeline.filterDiagnostic", "Diagnostics") },
    { key: "treatment", label: t("medicalTimeline.filterTreatment", "Treatments") },
    { key: "vaccination", label: t("medicalTimeline.filterVaccination", "Vaccinations") },
    { key: "surgery", label: t("medicalTimeline.filterSurgery", "Surgeries") },
    { key: "clearance", label: t("medicalTimeline.filterClearance", "Clearance") },
  ];

  const getCategoryIcon = (category: MedicalTimelineCategory) => {
    switch (category) {
      case "intake":
        return <Activity className="size-3.5 sm:size-4 text-info-text " />;
      case "diagnostic":
        return <Stethoscope className="size-3.5 sm:size-4 text-clinical-text " />;
      case "treatment":
        return <CheckCircle2 className="size-3.5 sm:size-4 text-warning-text " />;
      case "vaccination":
        return <Syringe className="size-3.5 sm:size-4 text-success-text " />;
      case "surgery":
        return <Scissors className="size-3.5 sm:size-4 text-danger-text " />;
      case "clearance":
        return <FileCheck2 className="size-3.5 sm:size-4 text-success-text " />;
      default:
        return <ShieldCheck className="size-3.5 sm:size-4 text-foreground" />;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return new Intl.DateTimeFormat(isMs ? "ms-MY" : "en-MY", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(date);
    } catch {
      return dateStr;
    }
  };

  return (
    <div className={`space-y-4 ${compact ? "p-3 bg-muted/20 rounded-xl" : "pt-2"}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-border pb-2.5">
        <div>
          <h3 className="font-heading text-lg sm:text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="size-5 text-success-text " />
            {t("medicalTimeline.title", "Rescue & Veterinary Care Timeline")}
          </h3>
          {!compact && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("medicalTimeline.subtitle", "Verified chronological clinical history, diagnostic screenings, treatments, and veterinary clearances.")}
            </p>
          )}
        </div>

        {/* Verification Tag */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-success-surface border border-success-border text-[11px] font-bold text-success-text rounded-full shrink-0">
          <Check className="size-3 text-success-accent stroke-[3]" />
          <span>{isMs ? "Rekod Sahih Veterinar" : "Shelter Vet Certified"}</span>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap gap-1.5 pt-1 overflow-x-auto pb-1" role="tablist" aria-label="Timeline Filters">
        {categories.map((cat) => (
          <button
            key={cat.key}
            type="button"
            role="tab"
            aria-selected={selectedCategory === cat.key}
            onClick={() => setSelectedCategory(cat.key)}
            className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
              selectedCategory === cat.key
                ? "bg-foreground text-background border-foreground font-bold shadow-xs"
                : "bg-background text-muted-foreground border-border hover:text-foreground hover:bg-muted"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Timeline Stream */}
      {filteredEvents.length === 0 ? (
        <div className="text-center py-6 text-xs text-muted-foreground bg-muted/20 border border-border p-4 rounded-xl">
          {t("medicalTimeline.noMilestones", "No milestones found for the selected category filter.")}
        </div>
      ) : (
        <div className="relative pl-6 sm:pl-8 space-y-4 pt-2">
          {/* Vertical Connecting Guide */}
          <div
            className="absolute left-2.75 sm:left-3.75 top-3 bottom-3 w-0.5 bg-neutral-border "
            aria-hidden="true"
          />

          {filteredEvents.map((event, index) => (
            <div key={event.id || index} className="relative group">
              {/* Timeline Node Dot */}
              <div
                className="absolute -left-6 sm:-left-8 top-1.5 size-6 sm:size-7 rounded-full bg-background border-2 border-border flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform"
                aria-hidden="true"
              >
                {getCategoryIcon(event.category)}
              </div>

              {/* Event Card */}
              <div className="bg-background border border-border rounded-xl p-3.5 sm:p-4 shadow-xs space-y-1.5 transition-colors hover:border-foreground/30">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      {formatDate(event.date)}
                    </span>
                    {event.badge && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getCategoryBadgeClasses(
                          event.category
                        )}`}
                      >
                        {event.badge}
                      </span>
                    )}
                  </div>

                  {event.verified && (
                    <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                      <Check className="size-3 text-success-accent stroke-[2.5]" />
                      {t("common.verified", "Verified")}
                    </span>
                  )}
                </div>

                <h4 className="font-heading text-sm sm:text-base font-bold text-foreground">
                  {event.title}
                </h4>

                <p className="text-xs text-foreground/85 leading-relaxed">
                  {event.description}
                </p>

                {event.veterinarian && (
                  <div className="pt-1 text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Stethoscope className="size-3 text-primary shrink-0" />
                    <span>
                      {t("medicalTimeline.verifiedBy", "Verified by")} <strong>{event.veterinarian}</strong>
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
