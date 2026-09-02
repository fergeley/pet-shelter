"use client";

import { Award } from "lucide-react";
import { cn } from "@/lib/utils";
import { tierLabel } from "@/lib/domain/supporterTier";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { SupporterTier } from "@/types/supporter";

/**
 * Tier colours are set as explicit light/dark pairs rather than theme tokens: the three
 * standings need to stay distinguishable from each other, which a single accent token
 * cannot do.
 */
const TIER_STYLES: Record<SupporterTier, string> = {
  BRONZE:
    "border-[#c98a5e] bg-[#fdf1e7] text-[#8a4f24] dark:border-[#8a5a35] dark:bg-[#3a2a1d] dark:text-[#e6b98d]",
  SILVER:
    "border-[#9aa4b2] bg-[#f1f4f8] text-[#4a5567] dark:border-[#697487] dark:bg-[#2a2f38] dark:text-[#c7d0dc]",
  GOLD:
    "border-[#c9a227] bg-[#fdf6e0] text-[#7a5f0c] dark:border-[#93761c] dark:bg-[#3a3218] dark:text-[#e8cf7d]",
};

const NO_TIER_STYLE =
  "border-border bg-muted text-muted-foreground";

export function TierBadge({
  tier,
  className,
  showIcon = true,
}: {
  tier: SupporterTier | null;
  className?: string;
  showIcon?: boolean;
}) {
  const { isMs } = useLanguage();

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide",
        tier ? TIER_STYLES[tier] : NO_TIER_STYLE,
        className
      )}
    >
      {showIcon ? <Award className="size-3.5" aria-hidden /> : null}
      {tierLabel(tier, isMs)}
    </span>
  );
}
