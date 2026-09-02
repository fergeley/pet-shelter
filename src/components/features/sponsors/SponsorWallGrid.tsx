"use client";

import { Award } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { tierLabel } from "@/lib/domain/supporterTier";
import { SupporterTier, SponsorWallEntryDTO } from "@/types/supporter";

const TIER_ACCENTS: Record<SupporterTier, string> = {
  GOLD: "border-[#c9a227]/50 bg-[#fdf6e0]/60 dark:border-[#93761c]/50 dark:bg-[#3a3218]/40",
  SILVER: "border-[#9aa4b2]/50 bg-[#f1f4f8]/60 dark:border-[#697487]/50 dark:bg-[#2a2f38]/40",
  BRONZE: "border-[#c98a5e]/50 bg-[#fdf1e7]/60 dark:border-[#8a5a35]/50 dark:bg-[#3a2a1d]/40",
};

function formatYear(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : String(date.getFullYear());
}

/**
 * One standing's section of the public wall.
 *
 * Receives only `SponsorWallEntryDTO` values, which carry a name, a tier and a join year
 * and nothing else — there is no amount or contact detail available to render by mistake.
 */
export function SponsorWallGrid({
  tier,
  entries,
}: {
  tier: SupporterTier;
  entries: SponsorWallEntryDTO[];
}) {
  const { isMs } = useLanguage();

  if (entries.length === 0) return null;

  return (
    <section aria-labelledby={`wall-${tier}`} className="space-y-4">
      <div className="flex items-baseline gap-3">
        <h2
          id={`wall-${tier}`}
          className="inline-flex items-center gap-2 font-heading text-2xl font-bold text-foreground"
        >
          <Award className="size-5 text-primary" aria-hidden />
          {isMs
            ? `Penaja ${tierLabel(tier, true)}`
            : `${tierLabel(tier, false)} sponsors`}
        </h2>
        <span className="text-sm tabular-nums text-muted-foreground">
          {entries.length}
        </span>
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((entry) => (
          <li
            key={`${entry.name}-${entry.memberSince}`}
            className={`rounded-xl border px-4 py-3 ${TIER_ACCENTS[tier]}`}
          >
            <p className="font-semibold leading-snug text-foreground">{entry.name}</p>
            <p className="text-xs text-muted-foreground">
              {isMs ? "Penaja sejak " : "Sponsor since "}
              {formatYear(entry.memberSince)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
