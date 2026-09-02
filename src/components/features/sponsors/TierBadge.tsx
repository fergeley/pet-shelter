"use client";

import { Award } from "lucide-react";
import { cn } from "@/lib/utils";
import { tierLabel } from "@/lib/domain/supporterTier";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { SupporterTier } from "@/types/supporter";

/**
 * One colour per standing, declared in `globals.css` as `--standing-*`.
 *
 * Outside the seven-tone contract on purpose: a standing is brand identity, not
 * semantic status. They resolve per theme through the token layer, so no `dark:`
 * variant belongs here.
 */
const TIER_STYLES: Record<SupporterTier, string> = {
  BRONZE: "border-standing-bronze-line bg-standing-bronze text-standing-bronze-label",
  SILVER: "border-standing-silver-line bg-standing-silver text-standing-silver-label",
  GOLD: "border-standing-gold-line bg-standing-gold text-standing-gold-label",
};

const NO_TIER_STYLE = "border-border bg-muted text-muted-foreground";

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
